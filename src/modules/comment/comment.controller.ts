import { Request, Response } from 'express';
import * as commentService from './comment.service.ts';
import { CreateCommentBodySchema, UpdateCommentBodySchema } from './comment.dto.ts';
import { validate } from '../../shared/utils/validate.ts';

export async function getComments(req: Request, res: Response): Promise<void> {
  const comments = await commentService.getCommentsByPost(req.params.postId as string);
  res.status(200).json(comments);
}

export async function createComment(req: Request, res: Response): Promise<void> {
  const body = validate(CreateCommentBodySchema, req.body);
  const newComment = await commentService.createComment(
    req.user!.userId,
    req.params.postId as string,
    body,
  );
  res.status(201).json(newComment);
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  const body = validate(UpdateCommentBodySchema, req.body);
  const updated = await commentService.updateComment(
    req.user!.userId,
    req.params.postId as string,
    req.params.id as string,
    body,
  );
  res.status(200).json(updated);
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  await commentService.deleteComment(
    req.user!.userId,
    req.params.postId as string,
    req.params.id as string,
  );
  res.status(204).send();
}
