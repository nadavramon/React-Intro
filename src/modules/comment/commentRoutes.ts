import { Router } from 'express';
import { getComments, createComment, deleteComment } from './commentController.ts';

const router = Router({ mergeParams: true });

router.route('/').get(getComments).post(createComment);

router.route('/:id').delete(deleteComment);

export default router;
