# Graph Chatbot

An AI chatbot application built with Next.js that combines traditional chat capabilities with knowledge graph search and document retrieval. This application provides an intelligent conversational interface with advanced features for knowledge discovery and document analysis.

## 🚀 Features

### Core Chat Features

- **Multi-model AI Support**: GPT-4o and GPT-4o Reasoning models
- **Real-time Streaming**: Live response streaming with typing indicators
- **Message History**: Persistent chat history with session management
- **File Attachments**: Upload and analyze documents (PDF, images, etc.)
- **Code Execution**: Interactive code blocks with syntax highlighting
- **Artifact Generation**: Create and edit code, documents, and images
- **Responsive Design**: Mobile-first design with dark/light themes

### Knowledge Graph Integration

- **Neo4j Graph Database**: Store and query complex relationships
- **Intelligent Search**: Find entities and relationships in your knowledge base
- **Toggle Control**: Enable/disable KG search to compare response quality
- **Graph Statistics**: View knowledge base metrics and insights

### Document Management (RAG)

- **PDF Processing**: Upload and analyze PDF documents
- **Vector Search**: Semantic search through document content
- **Document Sidebar**: Easy access to uploaded documents
- **Citation Support**: Track and display document sources

### Advanced Features

- **User Authentication**: Secure login with NextAuth.js
- **Privacy Controls**: Public/private chat visibility settings
- **Export Capabilities**: Download conversations and artifacts
- **Keyboard Shortcuts**: Power user navigation
- **Auto-resume**: Continue interrupted conversations

## 🔮 Future Development

### Evaluation & Quality Assurance

- **RAGAS Integration**: Automated evaluation of RAG system performance
- **Custom Metrics**: Response quality, relevance, and accuracy scoring
- **A/B Testing**: Compare different models and configurations
- **Continuous Monitoring**: Real-time performance tracking and alerting

### User Feedback & Learning

- **Vote System**: Thumbs up/down for responses (foundation already implemented)
- **Detailed Feedback**: Structured feedback collection for improvement
- **User Preference Learning**: Adaptive responses based on user patterns
- **Conversation Analytics**: Insights into user behavior and satisfaction

### Model Fine-tuning & MLOps

- **Custom Model Training**: Fine-tune models on domain-specific data
- **Amazon SageMaker Integration**: Scalable model training and deployment
- **Model Versioning**: Track and manage different model versions
- **Automated Retraining**: Trigger retraining based on performance metrics
- **Model Drift Detection**: Monitor and alert on model performance degradation

### Advanced Features

- **Multi-modal Fine-tuning**: Custom models for specific document types
- **Domain-specific Embeddings**: Specialized vector models for different industries
- **Graph Neural Networks**: Advanced graph-based learning for knowledge graphs
- **Federated Learning**: Privacy-preserving model training across users

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **AI**: Vercel AI SDK, OpenAI GPT-4o
- **Database**: PostgreSQL with pgvector, Neo4j
- **Styling**: Tailwind CSS, Radix UI
- **Authentication**: NextAuth.js
- **File Storage**: Vercel Blob
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Docker and Docker Compose
- OpenAI API key

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd graph-chatbot
pnpm install
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Neo4j databases
pnpm docker:up

# Or manually with docker-compose
docker-compose up -d
```

### 3. Environment Setup

Create a `.env.local` file with the following variables:

```env
# Database
POSTGRES_URL="postgresql://postgres:password123@localhost:5432/graph_chatbot"

# Neo4j
NEO4J_URI="bolt://localhost:7687"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="password123"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Vercel Blob (optional)
BLOB_READ_WRITE_TOKEN="your-blob-token"
```

### 4. Database Setup

```bash
# Run database migrations
pnpm db:migrate

# Populate Neo4j with test data (optional)
pnpm kg:populate
```

### 5. Start Development Server

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## 🗄️ Database Management

### PostgreSQL (Main Database)

```bash
# View database in browser
pnpm db:studio

# Generate new migration
pnpm db:generate

# Push schema changes
pnpm db:push
```

### Neo4j (Knowledge Graph)

- **Web Interface**: [http://localhost:7474](http://localhost:7474)
- **Username**: `neo4j`
- **Password**: `password123`

## 🧪 Testing

```bash
# Run Playwright tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

## 📁 Project Structure

```
├── app/                    # Next.js app router
│   ├── (auth)/            # Authentication pages
│   ├── (chat)/            # Chat interface and API
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── elements/         # Chat-specific components
├── lib/                  # Utility libraries
│   ├── ai/              # AI SDK configuration
│   ├── db/              # Database schemas and queries
│   ├── neo4j/           # Knowledge graph service
│   └── rag/             # Document processing
├── hooks/               # Custom React hooks
└── artifacts/           # Generated content types
```

## 🔧 Configuration

### AI Models

Configure available models in `lib/ai/models.ts`:

- GPT-4o: Advanced multimodal capabilities
- GPT-4o Reasoning: Chain-of-thought reasoning

### Knowledge Graph

- Toggle KG search on/off using the KG button in the chat interface
- Query structured entities and relationships in Neo4j
- View graph statistics and relationships

### Document Processing

- Supported formats: PDF, images, text files
- Automatic text extraction and vectorization
- Semantic search across all uploaded documents

## 🏗️ Architecture

The Graph Chatbot implements a hybrid architecture combining traditional RAG with knowledge graph search:

```mermaid
flowchart TD
    %% User Interface
    User[User] --> UI[Next.js Frontend]

    %% API Layer
    UI --> API[Next.js API Routes]

    %% AI Processing
    API --> AI[AI SDK + OpenAI GPT-4o]

    %% Hybrid Search Pipeline
    subgraph Search[Hybrid Search Pipeline]
        API --> RAG[RAG Document Search]
        API --> KG[Knowledge Graph Search]
        RAG --> Vector[Vector Search - pgvector]
        KG --> Neo4j[(Neo4j Graph DB)]
        Vector --> Postgres[(PostgreSQL)]
    end

    %% Data Processing
    subgraph Processing[Data Processing Pipeline]
        Upload[Document Upload] --> Extract[PDF/Text Extraction]
        Extract --> Chunk[Text Chunking]
        Chunk --> Embed[Vector Embeddings]
        Embed --> Store[Store in PostgreSQL]

        Manual[Manual Data Entry] --> Graph[Graph Entity Creation]
        Graph --> Neo4j
    end

    %% Storage Layer
    subgraph Storage[Storage Layer]
        Postgres
        Neo4j
        Blob[Vercel Blob Storage]
    end

    %% Authentication
    subgraph Auth[Authentication]
        NextAuth[NextAuth.js]
        Session[Session Management]
    end

    UI --> Auth
    API --> Auth

    %% Observability & Evaluation
    subgraph Monitor[Observability & Evaluation]
        Logs[Application Logs]
        Metrics[Performance Metrics]
        Traces[Request Tracing]
        Evals[RAGAS Evaluations]
        Feedback[User Feedback & Votes]
    end

    API -.-> Monitor

    %% Future MLOps Pipeline
    subgraph MLOps[Future MLOps Pipeline]
        Feedback --> Training[Model Fine-tuning]
        Training --> SageMaker[Amazon SageMaker]
        SageMaker --> Deploy[Model Deployment]
        Deploy --> Versioning[Model Versioning]
        Versioning --> Drift[Drift Detection]
    end

    Monitor --> MLOps

    %% Styling
    classDef storage fill:#e1f5fe
    classDef processing fill:#f3e5f5
    classDef search fill:#e8f5e8
    classDef auth fill:#fff3e0
    classDef mlops fill:#ffebee

    class Postgres,Neo4j,Blob storage
    class Extract,Chunk,Embed,Graph processing
    class RAG,KG,Vector search
    class NextAuth,Session auth
    class Training,SageMaker,Deploy,Versioning,Drift mlops
```

### Key Components

- **Frontend**: Next.js with React 19 and TypeScript
- **AI Layer**: Vercel AI SDK with OpenAI GPT-4o models
- **Hybrid Search**: Combines vector search (RAG) with graph traversal (KG)
- **Storage**: PostgreSQL with pgvector + Neo4j graph database
- **Authentication**: NextAuth.js with secure session management
- **File Storage**: Vercel Blob for document and artifact storage

## 🚀 Deployment

### AWS Deployment

[Coming soon]

### Manual Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```
