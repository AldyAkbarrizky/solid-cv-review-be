import express, { Application, Request, Response } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';

import UserRoutes from './routes/user.routes';
import AuthRoutes from './routes/auth.routes';
import SettingsRoutes from './routes/settings.routes';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.config();
    this.routes();
  }

  private config(): void {
    const allowedOrigins = ['http://localhost:3000', 'https://cv-review.solidtechno.com'];

    const corsOptions: CorsOptions = {
      origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin!) !== -1 || !origin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    };

    this.app.use(cors(corsOptions));
    this.app.use(morgan('dev'));
    this.app.use(helmet());
    this.app.use(cookieParser());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
  }

  private routes(): void {
    this.app.get('/', (req: Request, res: Response) => {
      res.send('API is running');
    });

    this.app.use('/api/users', UserRoutes);
    this.app.use('/api/auth', AuthRoutes);
    this.app.use('/api/settings', SettingsRoutes);
  }
}

export default new App().app;
