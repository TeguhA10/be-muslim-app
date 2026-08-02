export interface User {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  avatar_url?: string;
  is_verified?: boolean;
  fcm_token?: string;
  created_at: Date;
}

export interface UserSettings {
  id: string;
  user_id: string;
  calculation_method: string; // e.g. KEMENAG, MWL, ISNA
  reminder_offset_minutes: number; // default 10
  notif_adzan_enabled: boolean;
  language: string; // e.g. 'id', 'en'
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: Date;
  author_name?: string;
  author_avatar?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked_by_me?: boolean;
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
  created_at: Date;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: Date;
  user_name?: string;
  user_avatar?: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: Date;
}

export interface Masjid {
  id: string;
  google_place_id?: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  distance_km?: number;
  average_rating?: number;
  reviews_count?: number;
}

export interface MasjidReview {
  id: string;
  masjid_id: string;
  user_id: string;
  rating: number; // 1-5
  comment?: string;
  created_at: Date;
  user_name?: string;
}

export interface IslamicEvent {
  id: string;
  name: string;
  hijri_date: string;
  gregorian_date?: string;
}

export interface PrayerLog {
  id: string;
  user_id: string;
  prayer_name: 'Subuh' | 'Dzuhur' | 'Ashar' | 'Maghrib' | 'Isya';
  date: string;
  completed: boolean;
}

export interface PrayerTimesData {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
  date: {
    readable: string;
    timestamp: string;
    hijri: {
      date: string;
      format: string;
      day: string;
      weekday: { en: string; ar: string };
      month: { number: number; en: string; ar: string };
      year: string;
      designation: { expanded: string };
    };
  };
}

export type NotificationType = 'LIKE_POST' | 'COMMENT_POST' | 'REPLY_COMMENT' | 'FOLLOW_USER' | 'ADZAN_REMINDER' | 'SYSTEM';

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id?: string;
  type: NotificationType;
  title: string;
  body: string;
  entity_type?: 'POST' | 'COMMENT' | 'USER' | 'PRAYER';
  entity_id?: string;
  is_read: boolean;
  created_at: Date;
  actor_name?: string;
  actor_avatar?: string;
}
