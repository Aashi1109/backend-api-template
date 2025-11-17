import { AsyncLocalStorage } from "async_hooks";

export interface IRequestContext {
  requestId: string;
  session?: { accessToken: string; refreshToken: string };
  // Use a more efficient structure for metrics
  metrics?: {
    [key: string]: number;
  };
  // Use a more efficient structure for errors
  errors?: Array<{
    message: string;
    timestamp: number;
  }>;
  // Use a more efficient structure for timings
  timings?: {
    [key: string]: number;
  };
}

const asyncLocalStorage = new AsyncLocalStorage<IRequestContext>();

const RequestContext = {
  run: <T>(context: IRequestContext, callback: () => T): T => {
    return asyncLocalStorage.run(context, callback);
  },

  getContext: (): IRequestContext | undefined => {
    return asyncLocalStorage.getStore();
  },

  getRequestId: (): string | undefined => {
    return asyncLocalStorage.getStore()?.requestId;
  },

  getSession: (): { accessToken: string; refreshToken: string } | undefined => {
    const context = asyncLocalStorage.getStore();
    return context?.session;
  },

  // Add method to update context
  updateContext: (updates: Partial<IRequestContext>): void => {
    const currentContext = asyncLocalStorage.getStore();
    if (currentContext) {
      // Merge the updates with current context
      Object.assign(currentContext, updates);
    }
  },

  // Add method to set specific values
  setContextValue: <K extends keyof IRequestContext>(
    key: K,
    value: IRequestContext[K]
  ): void => {
    const currentContext = asyncLocalStorage.getStore();
    if (currentContext) {
      currentContext[key] = value;
    }
  },
};

export default RequestContext;
