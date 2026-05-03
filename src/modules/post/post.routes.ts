import { Router } from 'express';
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  likePost,
} from './post.controller.ts';
import { authenticate } from '../../shared/middlewares/authenticate.ts';
import commentRoutes from '../comment/comment.routes.ts';

const router = Router();

router.use(authenticate);

router.route('/').get(getPosts).post(createPost);

router.route('/:id').get(getPostById).put(updatePost).delete(deletePost);

router.post('/:id/like', likePost);

router.use('/:postId/comments', commentRoutes);

export default router;
