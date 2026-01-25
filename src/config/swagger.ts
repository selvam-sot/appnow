import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'AppointmentNow API',
            version: '1.0.0',
            description: 'API documentation for the AppointmentNow appointment management system',
            contact: {
                name: 'API Support',
                email: 'support@appointmentnow.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            },
            {
                url: 'https://api.appointmentnow.com',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter JWT token'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        name: { type: 'string', example: 'John Doe' },
                        email: { type: 'string', example: 'john@example.com' },
                        phone: { type: 'string', example: '+1234567890' },
                        role: { type: 'string', enum: ['customer', 'vendor', 'admin'], example: 'customer' },
                        isActive: { type: 'boolean', example: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                Category: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                        name: { type: 'string', example: 'Beauty & Wellness' },
                        description: { type: 'string', example: 'Beauty and wellness services' },
                        image: { type: 'string', example: 'https://example.com/image.jpg' },
                        isActive: { type: 'boolean', example: true }
                    }
                },
                SubCategory: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string', example: 'Hair Salon' },
                        categoryId: { type: 'string' },
                        description: { type: 'string' },
                        image: { type: 'string' },
                        isActive: { type: 'boolean' }
                    }
                },
                Service: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string', example: 'Haircut' },
                        categoryId: { type: 'string' },
                        subCategoryId: { type: 'string' },
                        description: { type: 'string' },
                        image: { type: 'string' },
                        isActive: { type: 'boolean' }
                    }
                },
                Vendor: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string', example: 'Acme Services' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                        address: { type: 'string' },
                        city: { type: 'string' },
                        state: { type: 'string' },
                        country: { type: 'string' },
                        zipCode: { type: 'string' },
                        verificationStatus: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
                        isActive: { type: 'boolean' }
                    }
                },
                VendorService: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        vendorId: { type: 'string' },
                        serviceId: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number', example: 50 },
                        duration: { type: 'number', example: 60 },
                        isActive: { type: 'boolean' }
                    }
                },
                Appointment: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        customerId: { type: 'string' },
                        vendorServiceId: { type: 'string' },
                        appointmentDate: { type: 'string', format: 'date' },
                        startTime: { type: 'string', example: '10:00' },
                        endTime: { type: 'string', example: '11:00' },
                        status: {
                            type: 'string',
                            enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'rejected'],
                            example: 'pending'
                        },
                        paymentStatus: { type: 'string', enum: ['pending', 'completed', 'refunded', 'failed'] },
                        total: { type: 'number' },
                        notes: { type: 'string' }
                    }
                },
                Review: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        appointmentId: { type: 'string' },
                        customerId: { type: 'string' },
                        vendorServiceId: { type: 'string' },
                        rating: { type: 'number', minimum: 1, maximum: 5, example: 4 },
                        comment: { type: 'string' },
                        status: { type: 'string', enum: ['pending', 'approved', 'rejected'] }
                    }
                },
                SlotLock: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        vendorServiceId: { type: 'string' },
                        date: { type: 'string', format: 'date' },
                        fromTime: { type: 'string', example: '10:00' },
                        toTime: { type: 'string', example: '11:00' },
                        lockedBy: { type: 'string' },
                        paymentIntentId: { type: 'string' },
                        lockedAt: { type: 'string', format: 'date-time' },
                        expiresAt: { type: 'string', format: 'date-time' }
                    }
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        error: { type: 'string' }
                    }
                },
                PaginatedResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'array', items: {} },
                        pagination: {
                            type: 'object',
                            properties: {
                                page: { type: 'number' },
                                limit: { type: 'number' },
                                total: { type: 'number' },
                                totalPages: { type: 'number' }
                            }
                        }
                    }
                }
            },
            responses: {
                UnauthorizedError: {
                    description: 'Authentication token is missing or invalid',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                NotFoundError: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                ValidationError: {
                    description: 'Validation error',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                },
                TooManyRequests: {
                    description: 'Rate limit exceeded',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' }
                        }
                    }
                }
            }
        },
        tags: [
            { name: 'Authentication', description: 'User authentication endpoints' },
            { name: 'Users', description: 'User management endpoints' },
            { name: 'Categories', description: 'Category management endpoints' },
            { name: 'Sub Categories', description: 'Sub-category management endpoints' },
            { name: 'Services', description: 'Service management endpoints' },
            { name: 'Vendors', description: 'Vendor management endpoints' },
            { name: 'Vendor Services', description: 'Vendor service management endpoints' },
            { name: 'Appointments', description: 'Appointment management endpoints' },
            { name: 'Payments', description: 'Payment processing endpoints' },
            { name: 'Reviews', description: 'Review management endpoints' },
            { name: 'Notifications', description: 'Notification management endpoints' },
            { name: 'Slot Locks', description: 'Slot locking for payment processing' },
            { name: 'Dashboard', description: 'Admin dashboard endpoints' },
            { name: 'Settings', description: 'User settings endpoints' }
        ]
    },
    apis: [
        './src/routes/**/*.ts',
        './src/controllers/**/*.ts'
    ]
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
    // Swagger UI options
    const swaggerUiOptions = {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'AppointmentNow API Documentation'
    };

    // Serve Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

    // Serve raw OpenAPI spec as JSON
    app.get('/api-docs.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
};

export { swaggerSpec };
