import swaggerUi from 'swagger-ui-express';

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Tasks API',
    version: '1.0.0',
  },
  components: {
    schemas: {
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          title: { type: 'string', example: 'Buy groceries' },
          isCompleted: { type: 'boolean', example: false },
        },
      },
    },
  },
  paths: {
    '/tasks': {
      get: {
        summary: 'Get all tasks',
        parameters: [
          {
            name: 'isCompleted',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['true', 'false'] },
            description: 'Filter tasks by completion status',
          },
        ],
        responses: {
          200: {
            description: 'List of tasks',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
              },
            },
          },
          400: { description: 'Invalid isCompleted value' },
        },
      },
      post: {
        summary: 'Create a new task',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Buy groceries' },
                  isCompleted: { type: 'boolean', example: false },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Task created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } },
          },
          400: { description: 'Validation error' },
        },
      },
    },
    '/tasks/{id}': {
      get: {
        summary: 'Get a task by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Task found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } },
          },
          404: { description: 'Task not found' },
        },
      },
      put: {
        summary: 'Update a task',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Buy groceries' },
                  isCompleted: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Task updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } },
          },
          400: { description: 'Validation error' },
          404: { description: 'Task not found' },
        },
      },
      delete: {
        summary: 'Delete a task',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          204: { description: 'Task deleted' },
          404: { description: 'Task not found' },
        },
      },
    },
  },
};

export { swaggerUi, swaggerSpec };
