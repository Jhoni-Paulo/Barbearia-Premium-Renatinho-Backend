import { Router } from 'express';

import multer from 'multer'
import multerConfig from './config/multer'

import UserController from './app/controllers/UserController';
import SessionController from './app/controllers/SessionController';
import FileController from './app/controllers/FileController';
import ProviderController from './app/controllers/ProviderController';
import AppointmentController from './app/controllers/AppointmentController';
import ScheduleController from './app/controllers/ScheduleController';
import NotificationController from './app/controllers/NotificationController';
import AvailableController from './app/controllers/AvailableController';

import authMiddleware from './app/middlewares/auth'

const routes = new Router();
const upload = multer(multerConfig)


routes.post('/users', UserController.store)
routes.post('/sessions', SessionController.store)

routes.use(authMiddleware)

//USERS
routes.put('/users' ,UserController.update)

//PROVIDERS
routes.get('/providers', ProviderController.index)

//AVAILABLE
routes.get('/providers/:providerId/available', AvailableController.index)

//APPOINTMENTS
routes.get('/appointments', AppointmentController.index)
routes.post('/appointments', AppointmentController.store)
routes.delete('/appointments/:id', AppointmentController.delete)

//SCHEDULE
routes.get('/schedule', ScheduleController.index)

//NOTIFICATION
routes.get('/notifications', NotificationController.index)
routes.put('/notifications/:id', NotificationController.update)

//OUTROS
routes.post('/files', upload.single('file'), FileController.store)

export default routes;
