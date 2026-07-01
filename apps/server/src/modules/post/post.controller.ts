import { Request, Response } from 'express';
import * as postService from './post.service.ts';
import * as likeService from '../like/like.service.ts';
import { CreatePostBodySchema, UpdatePostBodySchema, GetPostsQuerySchema } from './post.dto.ts';
import { validate } from '../../shared/utils/validate.ts';

export async function getPosts(req: Request, res: Response): Promise<void> {
  const query = validate(GetPostsQuerySchema, req.query);
  const posts = await postService.getAllPosts(query as { userId?: string });
  res.status(200).json(posts);
}

export async function getPostById(req: Request, res: Response): Promise<void> {
  const post = await postService.getPostById(req.params.id as string);
  res.status(200).json(post);
}

export async function createPost(req: Request, res: Response): Promise<void> {
  const body = validate(CreatePostBodySchema, req.body);
  const newPost = await postService.createPost(req.user!.userId, body);
  res.status(201).json(newPost);
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const body = validate(UpdatePostBodySchema, req.body);
  const updated = await postService.updatePost(req.user!.userId, req.params.id as string, body);
  res.status(200).json(updated);
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  await postService.deletePost(req.user!.userId, req.params.id as string);
  res.status(204).send();
}

export async function likePost(req: Request, res: Response): Promise<void> {
  const liked = await likeService.likePost(req.user!.userId, req.params.id as string);
  res.status(200).json(liked);
}

export async function unlikePost(req: Request, res: Response): Promise<void> {
  const unliked = await likeService.unlikePost(req.user!.userId, req.params.id as string);
  res.status(200).json(unliked);
}
