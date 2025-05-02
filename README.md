# AI Govern Platform

A multi-tenant SaaS platform for AI governance that provides comprehensive data processing, bias analysis, and reporting capabilities with advanced DevOps infrastructure.

## Features

- Multi-tenant architecture with database schema separation
- User management and authentication
- Data upload and processing
- Webhook/API integrations
- AI bias analysis and detection
- Comprehensive reporting

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, Shadcn UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based auth
- **Containerization**: Docker with multi-stage builds
- **Web Server**: Nginx

## Development Setup

### Prerequisites

- Node.js (v20+)
- PostgreSQL database
- Docker and Docker Compose (optional for containerized development)

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-govern
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npm run db:push
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:5000

### Docker Development

For development with Docker:

```bash
docker-compose up -d
```

This starts the frontend, backend, and PostgreSQL database in containers.

## Production Deployment

### Docker-based Deployment

For containerized deployment:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### AWS EC2 Deployment

For detailed instructions on deploying to AWS EC2, see [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md).

## Project Structure

```
ai-govern/
├── client/              # Frontend React application
│   ├── src/             # Source code
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities and helpers
│   │   ├── pages/       # Page components
│   │   └── ...
│   ├── Dockerfile       # Frontend Docker configuration
│   └── nginx.conf       # Nginx configuration for production
├── db/                  # Database setup and migration
├── server/              # Backend Express application
│   ├── Dockerfile       # Backend Docker configuration
│   └── ...
├── shared/              # Shared code (types, schemas, etc.)
├── docker-compose.yml         # Development Docker Compose configuration 
└── docker-compose.prod.yml    # Production Docker Compose configuration
```

## Environment Variables

Key environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `API_URL`: Backend API URL for frontend to connect to
- `VITE_API_URL`: Frontend environment variable for API URL

See `.env.example` for a complete list of environment variables.

## License

This project is licensed under the MIT License - see the LICENSE file for details.