import { Router } from 'express';
import { getPosts, getPostById, createPost, updatePost, deletePost } from './postController.ts';
import { authenticate } from '../../shared/middlewares/authenticate.ts';

const router = Router();

router.use(authenticate);

router.route('/').get(getPosts).post(createPost);

router.route('/:id').get(getPostById).put(updatePost).delete(deletePost);

export default router;
