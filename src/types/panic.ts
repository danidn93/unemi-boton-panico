export type PanicAlert = {
  id: string;
  status: "ACTIVE" | "CLOSED";
  target_department: string;
  location: any;
  device_info: {
    cedula?: string;
  };
  notes?: string;
  created_at: string;
};
