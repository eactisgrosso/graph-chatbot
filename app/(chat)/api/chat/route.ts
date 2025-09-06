import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
} from 'ai';
import { z } from 'zod';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { searchRelevantChunks } from '@/lib/rag/utils';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      kgSearchEnabled,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      kgSearchEnabled: boolean;
    } = requestBody;
    console.log('🔧 API Route - received kgSearchEnabled:', kgSearchEnabled);

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Extract text from user message for RAG search
    const userMessageText = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' ');

    // Search for relevant chunks using RAG
    let ragContext = '';
    if (userMessageText.trim()) {
      try {
        const relevantChunks = await searchRelevantChunks({
          query: userMessageText,
          userId: session.user.id,
          limit: 3,
          threshold: 0.3,
        });

        if (relevantChunks.length > 0) {
          ragContext = `\n\n**RELEVANT DOCUMENT CONTEXT:**\nThe following information is from your uploaded documents. When referencing this information in your response, you MUST cite the source using the format [Source: Document Name].\n\n${relevantChunks
            .map(
              (chunk, index) =>
                `**Source ${index + 1}: ${chunk.documentTitle}**\n${chunk.content}`,
            )
            .join(
              '\n\n',
            )}\n\n**Remember: Always cite your sources when using this information!**`;
        }
      } catch (error) {
        console.error('RAG search error:', error);
        // Continue without RAG context if search fails
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system:
            systemPrompt({ selectedChatModel, requestHints, kgSearchEnabled }) +
            ragContext,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : kgSearchEnabled
                ? [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                    'kgSearch',
                  ]
                : [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                  ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
            ...(kgSearchEnabled
              ? {
                  kgSearch: tool({
                    description:
                      'Search the biomedical knowledge graph for entities, relationships, and contextual information. Use this when users ask about biomedical concepts, diseases, drugs, proteins, or biological processes.',
                    inputSchema: z.object({
                      query: z
                        .string()
                        .describe(
                          'The search query for biomedical entities or concepts',
                        ),
                      limit: z
                        .number()
                        .optional()
                        .describe(
                          'Maximum number of entities to return (default: 5)',
                        ),
                    }),
                    execute: async ({ query, limit = 5 }) => {
                      // Use the original kgSearch tool logic
                      const { kgService } = await import(
                        '@/lib/neo4j/kg-service'
                      );

                      try {
                        console.log(
                          '🔍 KG Search tool called with query:',
                          query,
                        );
                        console.log('🧬 KNOWLEDGE GRAPH SEARCH ACTIVATED!');

                        // Ensure limit is always an integer
                        const intLimit = Math.floor(Number(limit));
                        console.log(
                          '🔢 Using limit:',
                          intLimit,
                          'type:',
                          typeof intLimit,
                        );

                        // Search for entities in the knowledge graph
                        const entities = await kgService.searchEntities(
                          query,
                          intLimit,
                        );
                        console.log(
                          '🔍 Raw entities from kgService:',
                          JSON.stringify(entities, null, 2),
                        );

                        // Get relationships for found entities
                        const relationships: any[] = [];
                        if (entities.length > 0) {
                          for (const entity of entities.slice(0, 3)) {
                            // Limit to first 3 entities
                            console.log(
                              `🔗 Searching relationships for entity ID: ${entity.id} (${entity.properties.name})`,
                            );
                            const entityRelationships =
                              await kgService.getRelationships(
                                entity.id,
                                intLimit,
                              );
                            console.log(
                              `🔗 Found ${entityRelationships.length} relationships for ${entity.properties.name}`,
                            );
                            if (entityRelationships.length > 0) {
                              console.log(
                                '🔗 Raw relationship data:',
                                JSON.stringify(entityRelationships, null, 2),
                              );
                              relationships.push(...entityRelationships);
                            }
                          }
                        }

                        // Get graph statistics
                        const stats = await kgService.getGraphStats();
                        console.log('📈 Graph stats:', stats);

                        return {
                          query,
                          entities,
                          relationships,
                          stats,
                          timestamp: new Date().toISOString(),
                        };
                      } catch (error) {
                        console.error('Error in KG search:', error);
                        return {
                          error: 'Failed to search knowledge graph',
                          query,
                          entities: [],
                          relationships: [],
                          stats: null,
                          timestamp: new Date().toISOString(),
                        };
                      }
                    },
                  }),
                }
              : {}),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
