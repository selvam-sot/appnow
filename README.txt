# Category Management System

A simple Node.js TypeScript Express application with MongoDB (Azure Cosmos DB) integration for category management.

## Features

- RESTful API for CRUD operations on categories
- MongoDB integration with Azure Cosmos DB
- TypeScript for type safety
- Express framework

## Prerequisites

- Node.js (v20+)
- Azure Cosmos DB with MongoDB API enabled
- Your Azure Cosmos DB connection string

## Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/category-management-system.git
   cd category-management-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the values with your Azure Cosmos DB connection string

4. Build and run the application:
   ```bash
   # For development
   npm run dev
   
   # For production
   npm run build
   npm start
   ```

## Azure Deployment

### Deploying to Azure App Service

1. Create an Azure App Service:
   - Go to Azure Portal
   - Create a new Web App service
   - Select Node.js runtime

2. Configure Environment Variables:
   - In Azure Portal, go to your App Service
   - Navigate to Settings > Configuration
   - Add application settings for all variables from your `.env` file

3. Deploy from GitHub:
   - In Azure Portal, go to your App Service
   - Navigate to Deployment Center
   - Select GitHub as the source
   - Configure the deployment options
   - Select your repository and branch

4. Verify the deployment:
   - Visit the URL for your App Service
   - You should see the welcome message from the API

## API Endpoints

- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create a new category
- `GET /api/categories/:id` - Get a specific category
- `PUT /api/categories/:id` - Update a category
- `DELETE /api/categories/:id` - Delete a category
- `PATCH /api/categories/:id/toggle-favorite` - Toggle favorite status
- `PATCH /api/categories/:id/toggle-active` - Toggle active status

## Important Notes for Azure Cosmos DB

1. The connection string in the `.env` file must include:
   - `retryWrites=false` - Required for Cosmos DB
   - `ssl=true` - Required for secure connection

2. Make sure your Azure Cosmos DB is configured with MongoDB API.

3. For cost optimization, consider your provisioned throughput (RU/s) settings in Azure.