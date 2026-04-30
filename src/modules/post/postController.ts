import { Request, Response, NextFunction } from 'express';
import * as postService from './postService.ts';
import { CreatePostBodySchema, UpdatePostBodySchema, GetPostsQuerySchema } from './post.dto.ts';
import { validate } from '../../shared/utils/validate.ts';

export async function getPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = validate(GetPostsQuerySchema, req.query);
    const posts = await postService.getAllPosts(query as { userId?: string });
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
}

export async function getPostById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const post = await postService.getPostById(req.params.id as string);
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
}

export async function createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validate(CreatePostBodySchema, req.body);
    const newPost = await postService.createPost(req.user!.userId, body);
    res.status(201).json(newPost);
  } catch (err) {
    next(err);
  }
}

export async function updatePost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validate(UpdatePostBodySchema, req.body);
    const updated = await postService.updatePost(req.user!.userId, req.params.id as string, body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deletePost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await postService.deletePost(req.user!.userId, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function likePost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const liked = await postService.likePost(req.params.id as string);
    res.status(200).json(liked);
  } catch (err) {
    next(err);
  }
}
