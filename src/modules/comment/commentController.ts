import { Request, Response, NextFunction } from 'express';
import * as commentService from './commentService.ts';
import { CreateCommentBodySchema, UpdateCommentBodySchema } from './comment.dto.ts';
import { validate } from '../../shared/utils/validate.ts';

export async function getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const comments = await commentService.getCommentsByPost(req.params.postId as string);
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
}

export async function createComment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = validate(CreateCommentBodySchema, req.body);
    const newComment = await commentService.createComment(
      req.user!.userId,
      req.params.postId as string,
      body,
    );
    res.status(201).json(newComment);
  } catch (err) {
    next(err);
  }
}

export async function updateComment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = validate(UpdateCommentBodySchema, req.body);
    const updated = await commentService.updateComment(
      req.user!.userId,
      req.params.postId as string,
      req.params.id as string,
      body,
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await commentService.deleteComment(
      req.user!.userId,
      req.params.postId as string,
      req.params.id as string,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
