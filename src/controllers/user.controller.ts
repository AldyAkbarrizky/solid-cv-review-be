import { Request, Response } from 'express';
import User from '../models/user.model';

export const getUsers = async (req: Request, res: Response): Promise<Response> => {
  const users = await User.findAll();
  return res.json(users);
};

export const createUser = async (req: Request, res: Response): Promise<Response> => {
  const { name, email, password } = req.body;
  const newUser = await User.create({ name, email, password });
  return res.json(newUser);
};

export const getUser = async (req: Request, res: Response): Promise<Response> => {
  const user = await User.findByPk(req.params.id);
  return res.json(user);
};

export const updateUser = async (req: Request, res: Response): Promise<Response> => {
  const { name, email, password } = req.body;
  await User.update({ name, email, password }, { where: { id: req.params.id } });
  const updatedUser = await User.findByPk(req.params.id);
  return res.json(updatedUser);
};

export const deleteUser = async (req: Request, res: Response): Promise<Response> => {
  await User.destroy({ where: { id: req.params.id } });
  return res.json({ message: 'User deleted successfully' });
};
