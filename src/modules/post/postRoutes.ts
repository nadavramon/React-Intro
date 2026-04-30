import { Router } from 'express';
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  likePost,
} from './postController.ts';
import { authenticate } from '../../shared/middlewares/authenticate.ts';
import commentRoutes from '../comment/commentRoutes.ts';

const router = Router();

router.use(authenticate);

router.route('/').get(getPosts).post(createPost);

router.route('/:id').get(getPostById).put(updatePost).delete(deletePost);

router.post('/:id/like', likePost);

router.use('/:postId/comments', commentRoutes);

export default router;
