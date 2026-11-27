-- Migration 20: Enum Extensions for Assignment Draft/Review & Notification Categories
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'security';
