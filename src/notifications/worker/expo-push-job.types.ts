/** Prefix every worker log message so Better Stack / grep can filter `expo-push-worker`. */
export const EXPO_PUSH_WORKER_LOG_PREFIX = '[expo-push-worker]' as const;

export function expoPushWorkerLog(message: string): string {
  return `${EXPO_PUSH_WORKER_LOG_PREFIX} ${message}`;
}

export const EXPO_PUSH_QUEUE_NAME = 'expo_push';
export const EXPO_PUSH_JOB_SEND_NAME = 'expo_push.send';

export type ExpoPushSendJobData = {
  notificationId: string;
  /**
   * Data payload delivered to client (expo-notifications).
   * Keep it small (IDs only) so the job remains efficient.
   */
  pushData: {
    type: string;
    receiptId?: string;
    status?: string;
  };
};
