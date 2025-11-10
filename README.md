# Ivorian Realty - Complete Platform

> CI/CD Pipeline Active - Auto-deploying to EC2

A comprehensive real estate platform built with modern microservices architecture and React frontend.

## 🏗️ Project Structure

```
Ivorian-Realty/
├── backend/                 # Backend microservices
│   └── microservices/      # 6 independent microservices
│       ├── api-gateway/    # Team A - Entry point (Port 3000)
│       ├── auth-service/   # Team B - Authentication (Port 3001)
│       ├── property-service/ # Team C - Property management (Port 3002)
│       ├── user-service/   # Team D - User management (Port 3003)
│       ├── notification-service/ # Team E - Notifications (Port 3004)
│       ├── file-service/   # Team F - File handling (Port 3005)
│       ├── shared-lib/     # Shared utilities (All teams)
│       ├── infrastructure/ # Infrastructure setup (DevOps)
│       └── scripts/        # Setup and utility scripts
├── frontend/               # React frontend application
│   ├── src/               # React source code
│   ├── public/            # Static assets
│   ├── package.json       # Frontend dependencies
│   └── README.md          # Frontend documentation
├── docs/                  # Project documentation
├── scripts/               # Project-wide scripts
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Ivorian-Realty
```

### 2. Start Backend Services

```bash
# Start infrastructure (MongoDB, Redis)
cd backend/microservices/infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Start API Gateway
cd ../api-gateway
npm install
npm run dev

# Start other services as needed
cd ../auth-service
npm install
npm run dev
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3000/api
- **Backend Services**: http://localhost:3001-3005

## 👥 Team Development

### Backend Teams

Each microservice is owned by a different team:

| Service | Port | Team | Purpose |
|---------|------|------|---------|
| API Gateway | 3000 | Team A | Entry point and routing |
| Auth Service | 3001 | Team B | Authentication & authorization |
| Property Service | 3002 | Team C | Property management |
| User Service | 3003 | Team D | User profiles |
| Notification Service | 3004 | Team E | Email, SMS, push notifications |
| File Service | 3005 | Team F | File upload & storage |

### Frontend Team

- **Frontend Team**: React application and UI/UX

### DevOps Team

- **Infrastructure Team**: Database, monitoring, deployment

## 🔧 Development Workflow

### For Backend Teams

1. **Navigate to your service:**
   ```bash
   cd backend/microservices/<your-service-name>
   ```

2. **Setup your service:**
   ```bash
   ../scripts/setup-team.sh <your-service-name>
   ```

3. **Start development:**
   ```bash
   npm run dev
   ```

### For Frontend Team

1. **Navigate to frontend:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development:**
   ```bash
   npm run dev
   ```

## 🏗️ Architecture

### Backend Architecture

- **Microservices**: 6 independent services
- **API Gateway**: Single entry point
- **Shared Library**: Common utilities and types
- **Database**: MongoDB with Redis caching
- **Authentication**: JWT-based authentication
- **Monitoring**: Prometheus and Grafana

### Frontend Architecture

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **Axios**: HTTP client for API calls
- **Context API**: State management

## 📊 Services Overview

### API Gateway (Port 3000)
- Routes requests to appropriate services
- Handles authentication and authorization
- Rate limiting and security
- Health checks and monitoring

### Authentication Service (Port 3001)
- User registration and login
- JWT token management
- Password reset functionality
- Email verification
- Role-based access control

### Property Service (Port 3002)
- Property CRUD operations
- Advanced search and filtering
- Property images and details
- Featured properties
- Geographic search

### User Service (Port 3003)
- User profile management
- User preferences
- Agent management
- User analytics

### Notification Service (Port 3004)
- Email notifications
- SMS notifications
- Push notifications
- Notification preferences
- Scheduled notifications

### File Service (Port 3005)
- File upload and storage
- Image processing and optimization
- File management
- AWS S3 integration

## 🔒 Security

### Authentication
- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Email verification
- Password reset functionality

### API Security
- Rate limiting
- CORS configuration
- Input validation
- SQL injection prevention
- XSS protection

## 🧪 Testing

### Backend Testing
```bash
cd backend/microservices/<service-name>
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

## 🚀 Deployment

### Development
```bash
# Start infrastructure
cd backend/microservices/infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Start services
cd ../api-gateway && npm run dev
cd ../auth-service && npm run dev
# ... start other services

# Start frontend
cd frontend && npm run dev
```

### Production
```bash
# Deploy backend services
cd backend/microservices
docker-compose -f docker-compose.yml up -d

# Deploy frontend
cd frontend
npm run build
# Deploy built files to your hosting service
```

## 📚 Documentation

- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
- [Team Setup Guide](./backend/microservices/TEAM-SETUP.md)
- [API Documentation](./backend/microservices/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Contact the team leads

---

**Built with ❤️ for Ivorian Realty**