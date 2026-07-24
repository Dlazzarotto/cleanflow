export type Role = 'owner' | 'admin' | 'supervisor' | 'cleaner';

export type BookingStatus =
  | 'orcamento'
  | 'agendado'
  | 'a_caminho'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado';

export interface Company {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise';
}

export interface Profile {
  id: string;
  company_id: string;
  full_name: string;
  role: Role;
  phone: string | null;
}

export interface Client {
  id: string;
  company_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  door_code: string | null;
  has_pets: boolean;
  pets_notes: string | null;
  alarm_notes: string | null;
  preferences: string | null;
  products_notes: string | null;
  frequency: 'unica' | 'semanal' | 'quinzenal' | 'mensal' | null;
  status: 'ativo' | 'inativo';
  created_at: string;
}

export interface Team {
  id: string;
  company_id: string;
  name: string;
  color: string;
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  base_price: number;
  base_minutes: number;
  active: boolean;
}

export interface Booking {
  id: string;
  company_id: string;
  client_id: string;
  team_id: string | null;
  service_id: string | null;
  series_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  status: BookingStatus;
  notes: string | null;
  clients?: Pick<Client, 'full_name' | 'address' | 'lat' | 'lng'> | null;
  teams?: Pick<Team, 'name' | 'color'> | null;
}

export interface Suggestion {
  date: string;          // YYYY-MM-DD
  team_id: string;
  team_name: string;
  team_color: string;
  distance_mi: number;
  nearest_client: string;
  suggested_time: string; // HH:MM
  bookings_that_day: number;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  orcamento: 'Orçamento',
  agendado: 'Agendado',
  a_caminho: 'A caminho',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};
