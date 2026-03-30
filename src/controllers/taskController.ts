import { Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'crypto'; // Built-in Node.js module for generating UUIDs
import { taskStore } from '../data/taskStore.ts';
import { TaskEntity } from '../types/task.ts';


/*
  The controller sits right between the Router and the Model. It is the orchestrator of the operation. Its specific responsibilities are:

  Receiving the request handed over by the Router.
  Extracting the data the user sent (req.params, req.body).
  Validating the data (ensuring titles are strings; checking for bad IDs).
  Commanding the Model (telling taskStore to delete, fetch, or update).
  Formulating the final HTTP Response (sending back 200 OK or 404 Not Found with the right JSON).
*/

// Get all tasks
export function getTasks(req: Request, res: Response): void {
  res.status(200).json(taskStore); 
}

// Get a single task by ID
export function getTaskById(req: Request, res: Response): void {
  const { id } = req.params; // Destructure the id parameter from the request parameters
  const task = taskStore.find((task) => task.id === id); // Find the task in the taskStore

  if (!task) {
    res.status(404).json({ error: 'Task not found' }); // Return 404 (undefined - not found) if the task is not found
    return; // explicit return to prevent the function from continuing to execute
  }

  res.status(200).json(task);
}

// Create a new task
export function createTask(req: Request, res: Response): void {
  const { title } = req.body; // Pulls out the title property from the request body

  /* Checks if the title is - 
        1. empty or undefined
        2. not a string
        3. an empty string
  */
  if (!title || typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'Title is required and must be a non-empty string' }); // Return 400 (bad request)
    return;
  }

  // Prevent Denial of Service (Payload Bomb) by limiting title length
  if (title.length > 255) {
    res.status(400).json({ error: 'Title is too long (maximum 255 characters)' });
    return;
  }

  // Build a JS object that matches the TaskEntity interface
  const newTask: TaskEntity = {
    id: randomUUID(), // mathematically guaranteed to never accidentally generate the same ID twice and designed to handle and index this exact UUID format beautifully.
    title: title.trim(),
    isCompleted: false,
  };

  taskStore.push(newTask); // Push payload into the global array (in-memory database).
  res.status(201).json(newTask); // Return 201 (created)
}

// Update an existing task
export function updateTask(req: Request, res: Response): void {
  const { id } = req.params; // Destructure the id parameter from the request parameters
  const { title, isCompleted } = req.body as Partial<TaskEntity>; // Pulls out the title and completed properties from the request body

  // Ensure the user actually provided at least one valid field to update (Ghost Update prevention)
  if (title === undefined && isCompleted === undefined) {
    res.status(400).json({ error: 'Please provide either a title or isCompleted status to update' });
    return;
  }

  const taskIndex = taskStore.findIndex((task) => task.id === id); // Find the task in the taskStore

  const taskToUpdate = taskStore[taskIndex]; // Get the task to update
  if (!taskToUpdate) { // User guessed a bad ID
    res.status(404).json({ error: 'Task not found' }); // Returns 404 (undefined - not found)
    return;
  }

  // Update only provided fields
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'Title must be a non-empty string' });
      return;
    }
    
    // Prevent Payload Bomb
    if (title.length > 255) {
      res.status(400).json({ error: 'Title is too long (maximum 255 characters)' });
      return;
    }
    
    taskToUpdate.title = title.trim();
  }

  if (isCompleted !== undefined) {
    if (typeof isCompleted !== 'boolean') {
      res.status(400).json({ error: 'Completed must be a boolean' });
      return;
    }
    taskToUpdate.isCompleted = isCompleted;
  }

  res.status(200).json(taskToUpdate);
}

// Delete a task
export function deleteTask(req: Request, res: Response): void {
  const { id } = req.params;
  const taskIndex = taskStore.findIndex((task) => task.id === id);

  if (taskIndex === -1) { // hardcoded to return -1 to verify the target doesn't exist
    res.status(404).json({ error: 'Task not found' }); // Returns 404 (undefined - not found)
    return;
  }

  taskStore.splice(taskIndex, 1); // Removes the task from the array - remove from taskIndex, delete 1 element
  res.status(200).json({ message: 'Task deleted successfully' });
}

// Get all tasks by status
export function getTasksByStatus(req: Request, res: Response): void {
  const { status } = req.params; // Extracting a string, not a boolean, from the URL
  
  // Ensure the route parameter is precisely "true" or "false"
  if (status !== 'true' && status !== 'false') {
    res.status(400).json({ error: 'Status must be strictly "true" or "false"' });
    return;
  }

  const completed = status === 'true'; // Type-Casting : evaluates into a literal boolean value
  const filteredTasks = taskStore.filter((task) => task.isCompleted === completed); // Generates a new sub array that matches the boolean value

  res.status(200).json(filteredTasks);
}
