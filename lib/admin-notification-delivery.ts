export type AdminNotificationDeliveryResult = {
  status: "NOT_CONFIGURED" | "PENDING" | "SENT" | "FAILED";
  messageId?: string;
  error?: string;
};

export interface AdminNotificationDeliveryAdapter {
  configured: boolean;
  send(input: { title: string; message: string; actionHref: string }): Promise<AdminNotificationDeliveryResult>;
}

export const whatsappCloudNotificationAdapter: AdminNotificationDeliveryAdapter = {
  configured: false,
  async send() {
    return { status: "NOT_CONFIGURED", error: "Meta WhatsApp Cloud API ainda não configurada." };
  }
};
