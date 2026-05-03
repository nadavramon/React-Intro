import { Router } from 'express';
import { getComments, createComment, updateComment, deleteComment } from './comment.controller.ts';

const router = Router({ mergeParams: true });

router.route('/').get(getComments).post(createComment);

router.route('/:id').put(updateComment).delete(deleteComment);

export default router;
