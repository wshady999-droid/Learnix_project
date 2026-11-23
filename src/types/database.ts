export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          mode: string
          role_context: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          mode?: string
          role_context?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          mode?: string
          role_context?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_document_chunks: {
        Row: {
          chunk_index: number
          content: string
          course_id: string
          created_at: string
          embedding: string | null
          id: string
          lesson_id: string | null
          source_title: string
          source_type: string
          tsv: unknown
          uploaded_by: string
        }
        Insert: {
          chunk_index?: number
          content: string
          course_id: string
          created_at?: string
          embedding?: string | null
          id?: string
          lesson_id?: string | null
          source_title: string
          source_type?: string
          tsv?: unknown
          uploaded_by: string
        }
        Update: {
          chunk_index?: number
          content?: string
          course_id?: string
          created_at?: string
          embedding?: string | null
          id?: string
          lesson_id?: string | null
          source_title?: string
          source_type?: string
          tsv?: unknown
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_document_chunks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_document_chunks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_document_chunks_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          feedback_rating: number | null
          id: string
          sender: string
          structured_payload: Json | null
          user_id: string
        }
        Insert: {
          citations?: Json
          content: string
          conversation_id: string
          created_at?: string
          feedback_rating?: number | null
          id?: string
          sender: string
          structured_payload?: Json | null
          user_id: string
        }
        Update: {
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          feedback_rating?: number | null
          id?: string
          sender?: string
          structured_payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          course_id: string | null
          created_at: string
          error_message: string | null
          feature: string
          id: string
          prompt_chars: number
          provider: string
          response_chars: number
          role_context: string
          status: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          error_message?: string | null
          feature: string
          id?: string
          prompt_chars?: number
          provider?: string
          response_chars?: number
          role_context?: string
          status?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          error_message?: string | null
          feature?: string
          id?: string
          prompt_chars?: number
          provider?: string
          response_chars?: number
          role_context?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attachment_storage_path: string | null
          feedback: string | null
          grade_points: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submission_text: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          attachment_storage_path?: string | null
          feedback?: string | null
          grade_points?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submission_text?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          attachment_storage_path?: string | null
          feedback?: string | null
          grade_points?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submission_text?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submissions: boolean
          attachment_storage_path: string | null
          course_id: string
          created_at: string
          created_by: string
          description: string
          due_at: string | null
          id: string
          is_published: boolean
          lesson_id: string | null
          max_points: number
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submissions?: boolean
          attachment_storage_path?: string | null
          course_id: string
          created_at?: string
          created_by: string
          description: string
          due_at?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          max_points?: number
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submissions?: boolean
          attachment_storage_path?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          id?: string
          is_published?: boolean
          lesson_id?: string | null
          max_points?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string | null
          course_id: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string
          session_date: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by: string
          session_date?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          session_date?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_id: string
          id: string
          recorded_at: string
          remarks: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_id: string
          id?: string
          recorded_at?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_id?: string
          id?: string
          recorded_at?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          course_id: string
          final_score: number | null
          id: string
          issued_at: string
          issued_by: string | null
          revoked_at: string | null
          storage_path: string | null
          student_id: string
          verification_hash: string
        }
        Insert: {
          certificate_number: string
          course_id: string
          final_score?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          revoked_at?: string | null
          storage_path?: string | null
          student_id: string
          verification_hash: string
        }
        Update: {
          certificate_number?: string
          course_id?: string
          final_score?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          revoked_at?: string | null
          storage_path?: string | null
          student_id?: string
          verification_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          class_id: string
          course_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          notes: string | null
          room: string | null
          start_time: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          course_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          notes?: string | null
          room?: string | null
          start_time: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          course_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          room?: string | null
          start_time?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedules_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: string
          advisor_teacher_id: string | null
          code: string
          created_at: string
          department_id: string
          educational_level_id: string
          id: string
          is_active: boolean
          max_capacity: number
          name: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          advisor_teacher_id?: string | null
          code: string
          created_at?: string
          department_id: string
          educational_level_id: string
          id?: string
          is_active?: boolean
          max_capacity?: number
          name: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          advisor_teacher_id?: string | null
          code?: string
          created_at?: string
          department_id?: string
          educational_level_id?: string
          id?: string
          is_active?: boolean
          max_capacity?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_advisor_teacher_id_fkey"
            columns: ["advisor_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_educational_level_id_fkey"
            columns: ["educational_level_id"]
            isOneToOne: false
            referencedRelation: "educational_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          full_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          locale: string
          message: string
          status: Database["public"]["Enums"]["request_status"]
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          locale?: string
          message: string
          status?: Database["public"]["Enums"]["request_status"]
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          locale?: string
          message?: string
          status?: Database["public"]["Enums"]["request_status"]
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          last_message_at: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string
          id: string
          last_accessed_at: string | null
          progress_percent: number
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string
          id?: string
          last_accessed_at?: string | null
          progress_percent?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string
          id?: string
          last_accessed_at?: string | null
          progress_percent?: number
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_reviews: {
        Row: {
          comment: string | null
          course_id: string
          created_at: string
          id: string
          is_published: boolean
          rating: number
          student_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          course_id: string
          created_at?: string
          id?: string
          is_published?: boolean
          rating: number
          student_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          course_id?: string
          created_at?: string
          id?: string
          is_published?: boolean
          rating?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          class_id: string | null
          code: string
          completion_requirements: string | null
          created_at: string
          department_id: string | null
          description: string | null
          educational_level_id: string | null
          estimated_hours: number
          id: string
          is_featured: boolean
          language: string
          passing_score: number
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          subtitle: string | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          trailer_video_url: string | null
          updated_at: string
        }
        Insert: {
          category: string
          class_id?: string | null
          code: string
          completion_requirements?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          educational_level_id?: string | null
          estimated_hours?: number
          id?: string
          is_featured?: boolean
          language?: string
          passing_score?: number
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          subtitle?: string | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          trailer_video_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          class_id?: string | null
          code?: string
          completion_requirements?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          educational_level_id?: string | null
          estimated_hours?: number
          id?: string
          is_featured?: boolean
          language?: string
          passing_score?: number
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          subtitle?: string | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          trailer_video_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_educational_level_id_fkey"
            columns: ["educational_level_id"]
            isOneToOne: false
            referencedRelation: "educational_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          head_teacher_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          head_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          head_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_head_teacher_id_fkey"
            columns: ["head_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      educational_levels: {
        Row: {
          code: string
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          rank_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          rank_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          rank_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "educational_levels_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_grade_history: {
        Row: {
          answer_id: string
          attempt_id: string
          created_at: string
          feedback: string | null
          graded_by: string | null
          id: string
          points_awarded: number
          source: string
        }
        Insert: {
          answer_id: string
          attempt_id: string
          created_at?: string
          feedback?: string | null
          graded_by?: string | null
          id?: string
          points_awarded: number
          source: string
        }
        Update: {
          answer_id?: string
          attempt_id?: string
          created_at?: string
          feedback?: string | null
          graded_by?: string | null
          id?: string
          points_awarded?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_grade_history_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "student_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_grade_history_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essay_grade_history_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          assigned_question_ids: string[]
          assigned_version: number
          attempt_number: number
          camera_consent_granted: boolean
          consent_recorded_at: string | null
          created_at: string
          exam_id: string
          exam_session_id: string | null
          expires_at: string
          guardian_consent_confirmed: boolean
          id: string
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at: string | null
          updated_at: string
          violations_count: number
        }
        Insert: {
          assigned_question_ids?: string[]
          assigned_version?: number
          attempt_number?: number
          camera_consent_granted?: boolean
          consent_recorded_at?: string | null
          created_at?: string
          exam_id: string
          exam_session_id?: string | null
          expires_at: string
          guardian_consent_confirmed?: boolean
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at?: string | null
          updated_at?: string
          violations_count?: number
        }
        Update: {
          assigned_question_ids?: string[]
          assigned_version?: number
          attempt_number?: number
          camera_consent_granted?: boolean
          consent_recorded_at?: string | null
          created_at?: string
          exam_id?: string
          exam_session_id?: string | null
          expires_at?: string
          guardian_consent_confirmed?: boolean
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
          violations_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_exam_session_id_fkey"
            columns: ["exam_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          access_code: string | null
          class_id: string | null
          created_at: string
          created_by: string
          ends_at: string
          exam_id: string
          id: string
          is_active: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          class_id?: string | null
          created_at?: string
          created_by: string
          ends_at: string
          exam_id: string
          id?: string
          is_active?: boolean
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string
          exam_id?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_violations: {
        Row: {
          attempt_id: string
          details: Json
          id: string
          occurred_at: string
          severity: Database["public"]["Enums"]["violation_severity"]
          student_id: string
          violation_type: string
        }
        Insert: {
          attempt_id: string
          details?: Json
          id?: string
          occurred_at?: string
          severity?: Database["public"]["Enums"]["violation_severity"]
          student_id: string
          violation_type: string
        }
        Update: {
          attempt_id?: string
          details?: Json
          id?: string
          occurred_at?: string
          severity?: Database["public"]["Enums"]["violation_severity"]
          student_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_violations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_violations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          allow_answer_review: boolean
          assigned_student_ids: string[]
          available_from: string | null
          available_until: string | null
          camera_monitoring_enabled: boolean
          chapter_id: string | null
          class_id: string | null
          course_id: string
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number
          id: string
          instructions: string | null
          max_attempts: number
          max_violations_allowed: number
          passing_score: number
          random_question_count: number | null
          retention_days: number
          show_results_immediately: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          status: Database["public"]["Enums"]["exam_status"]
          strict_proctoring: boolean
          title: string
          total_points: number
          updated_at: string
          version_count: number
        }
        Insert: {
          allow_answer_review?: boolean
          assigned_student_ids?: string[]
          available_from?: string | null
          available_until?: string | null
          camera_monitoring_enabled?: boolean
          chapter_id?: string | null
          class_id?: string | null
          course_id: string
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number
          id?: string
          instructions?: string | null
          max_attempts?: number
          max_violations_allowed?: number
          passing_score?: number
          random_question_count?: number | null
          retention_days?: number
          show_results_immediately?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          strict_proctoring?: boolean
          title: string
          total_points?: number
          updated_at?: string
          version_count?: number
        }
        Update: {
          allow_answer_review?: boolean
          assigned_student_ids?: string[]
          available_from?: string | null
          available_until?: string | null
          camera_monitoring_enabled?: boolean
          chapter_id?: string | null
          class_id?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          instructions?: string | null
          max_attempts?: number
          max_violations_allowed?: number
          passing_score?: number
          random_question_count?: number | null
          retention_days?: number
          show_results_immediately?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          strict_proctoring?: boolean
          title?: string
          total_points?: number
          updated_at?: string
          version_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          lesson_id: string | null
          student_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          lesson_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          lesson_id: string
          student_id: string
          updated_at: string
          video_timestamp_seconds: number | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lesson_id: string
          student_id: string
          updated_at?: string
          video_timestamp_seconds?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lesson_id?: string
          student_id?: string
          updated_at?: string
          video_timestamp_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          course_id: string
          id: string
          is_completed: boolean
          last_position_seconds: number
          lesson_id: string
          student_id: string
          updated_at: string
          watched_seconds: number
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          id?: string
          is_completed?: boolean
          last_position_seconds?: number
          lesson_id: string
          student_id: string
          updated_at?: string
          watched_seconds?: number
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          id?: string
          is_completed?: boolean
          last_position_seconds?: number
          lesson_id?: string
          student_id?: string
          updated_at?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          attachment_storage_path: string | null
          chapter_id: string
          content_markdown: string | null
          content_type: Database["public"]["Enums"]["lesson_content_type"]
          course_id: string
          created_at: string
          duration_seconds: number
          external_resource_url: string | null
          id: string
          is_preview: boolean
          is_published: boolean
          position: number
          scheduled_publish_at: string | null
          summary: string | null
          title: string
          updated_at: string
          video_storage_path: string | null
        }
        Insert: {
          attachment_storage_path?: string | null
          chapter_id: string
          content_markdown?: string | null
          content_type?: Database["public"]["Enums"]["lesson_content_type"]
          course_id: string
          created_at?: string
          duration_seconds?: number
          external_resource_url?: string | null
          id?: string
          is_preview?: boolean
          is_published?: boolean
          position?: number
          scheduled_publish_at?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          video_storage_path?: string | null
        }
        Update: {
          attachment_storage_path?: string | null
          chapter_id?: string
          content_markdown?: string | null
          content_type?: Database["public"]["Enums"]["lesson_content_type"]
          course_id?: string
          created_at?: string
          duration_seconds?: number
          external_resource_url?: string | null
          id?: string
          is_preview?: boolean
          is_published?: boolean
          position?: number
          scheduled_publish_at?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          video_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number
          id: string
          message_id: string
          mime_type: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes: number
          id?: string
          message_id: string
          mime_type: string
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          message_id?: string
          mime_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_edited: boolean
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_edited?: boolean
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_recipients: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_read: boolean
          notification_id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_id: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          course_id: string | null
          created_at: string
          id: string
          is_announcement: boolean
          metadata: Json
          notification_type: Database["public"]["Enums"]["notification_type"]
          scheduled_for: string | null
          sender_id: string | null
          sent_at: string | null
          target_scope: string
          title: string
        }
        Insert: {
          action_url?: string | null
          body: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_announcement?: boolean
          metadata?: Json
          notification_type?: Database["public"]["Enums"]["notification_type"]
          scheduled_for?: string | null
          sender_id?: string | null
          sent_at?: string | null
          target_scope?: string
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          is_announcement?: boolean
          metadata?: Json
          notification_type?: Database["public"]["Enums"]["notification_type"]
          scheduled_for?: string | null
          sender_id?: string | null
          sent_at?: string | null
          target_scope?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string
          department_id: string | null
          educational_level_id: string | null
          email: string
          full_name: string | null
          id: string
          notification_preferences: Json
          phone: string | null
          preferred_locale: string
          preferred_theme: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          department_id?: string | null
          educational_level_id?: string | null
          email: string
          full_name?: string | null
          id: string
          notification_preferences?: Json
          phone?: string | null
          preferred_locale?: string
          preferred_theme?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          department_id?: string | null
          educational_level_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          notification_preferences?: Json
          phone?: string | null
          preferred_locale?: string
          preferred_theme?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_educational_level_id_fkey"
            columns: ["educational_level_id"]
            isOneToOne: false
            referencedRelation: "educational_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          option_text: string
          position: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text: string
          position?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          course_id: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          exam_id: string
          explanation: string | null
          id: string
          is_in_bank: boolean
          media_url: string | null
          points: number
          position: number
          prompt: string
          question_type: Database["public"]["Enums"]["question_type"]
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          exam_id: string
          explanation?: string | null
          id?: string
          is_in_bank?: boolean
          media_url?: string | null
          points?: number
          position?: number
          prompt: string
          question_type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          exam_id?: string
          explanation?: string | null
          id?: string
          is_in_bank?: boolean
          media_url?: string | null
          points?: number
          position?: number
          prompt?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          attempt_id: string
          course_id: string
          earned_points: number
          exam_id: string
          feedback: string | null
          graded_at: string
          graded_by: string | null
          id: string
          is_published: boolean
          passed: boolean
          score_percent: number
          student_id: string
          total_points: number
          updated_at: string
        }
        Insert: {
          attempt_id: string
          course_id: string
          earned_points: number
          exam_id: string
          feedback?: string | null
          graded_at?: string
          graded_by?: string | null
          id?: string
          is_published?: boolean
          passed: boolean
          score_percent: number
          student_id: string
          total_points: number
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          course_id?: string
          earned_points?: number
          exam_id?: string
          feedback?: string | null
          graded_at?: string
          graded_by?: string | null
          id?: string
          is_published?: boolean
          passed?: boolean
          score_percent?: number
          student_id?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: Database["public"]["Enums"]["user_role"]
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["user_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_answers: {
        Row: {
          ai_suggested_feedback: string | null
          ai_suggested_points: number | null
          answer_text: string | null
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean | null
          points_awarded: number | null
          question_id: string
          selected_option_id: string | null
          selected_option_ids: string[]
          teacher_feedback: string | null
          updated_at: string
        }
        Insert: {
          ai_suggested_feedback?: string | null
          ai_suggested_points?: number | null
          answer_text?: string | null
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id: string
          selected_option_id?: string | null
          selected_option_ids?: string[]
          teacher_feedback?: string | null
          updated_at?: string
        }
        Update: {
          ai_suggested_feedback?: string | null
          ai_suggested_points?: number | null
          answer_text?: string | null
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id?: string
          selected_option_id?: string | null
          selected_option_ids?: string[]
          teacher_feedback?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_answers_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      student_teacher_assignments: {
        Row: {
          assigned_by: string | null
          class_id: string | null
          created_at: string
          id: string
          is_active: boolean
          student_id: string
          teacher_id: string
        }
        Insert: {
          assigned_by?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          student_id: string
          teacher_id: string
        }
        Update: {
          assigned_by?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          ai_interactions_count: number
          course_id: string | null
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          lesson_id: string | null
          started_at: string
          student_id: string
        }
        Insert: {
          ai_interactions_count?: number
          course_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          lesson_id?: string | null
          started_at?: string
          student_id: string
        }
        Update: {
          ai_interactions_count?: number
          course_id?: string | null
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          lesson_id?: string | null
          started_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_requests: {
        Row: {
          created_at: string
          credentials_url: string | null
          department_id: string | null
          id: string
          qualifications: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specialization: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials_url?: string | null
          department_id?: string | null
          id?: string
          qualifications: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialization: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials_url?: string | null
          department_id?: string | null
          id?: string
          qualifications?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialization?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_reviews: {
        Row: {
          comment: string | null
          course_id: string | null
          created_at: string
          id: string
          is_published: boolean
          rating: number
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          rating: number
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          rating?: number
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_reviews_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_reviews_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          browser: string | null
          created_at: string
          device_fingerprint: string
          device_name: string | null
          id: string
          is_trusted: boolean
          last_active_at: string
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_fingerprint: string
          device_name?: string | null
          id?: string
          is_trusted?: boolean
          last_active_at?: string
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_fingerprint?: string
          device_name?: string | null
          id?: string
          is_trusted?: boolean
          last_active_at?: string
          os?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          is_granted: boolean
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          is_granted?: boolean
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          is_granted?: boolean
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_review_teacher_request: {
        Args: {
          p_approve: boolean
          p_request_id: string
          p_review_notes?: string
        }
        Returns: {
          created_at: string
          credentials_url: string | null
          department_id: string | null
          id: string
          qualifications: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specialization: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      issue_my_course_certificate: {
        Args: { p_course_id: string }
        Returns: {
          certificate_number: string
          course_id: string
          final_score: number | null
          id: string
          issued_at: string
          issued_by: string | null
          revoked_at: string | null
          storage_path: string | null
          student_id: string
          verification_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_exam_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          attempt_id: string
          course_id: string
          earned_points: number
          exam_id: string
          feedback: string | null
          graded_at: string
          graded_by: string | null
          id: string
          is_published: boolean
          passed: boolean
          score_percent: number
          student_id: string
          total_points: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "pending"
      attempt_status: "in_progress" | "submitted" | "graded" | "invalidated"
      attendance_status: "present" | "absent" | "late" | "excused"
      course_status: "draft" | "published" | "archived"
      enrollment_status: "active" | "completed" | "dropped"
      exam_status: "draft" | "published" | "closed" | "archived"
      lesson_content_type: "video" | "article" | "pdf" | "presentation" | "quiz"
      notification_type:
        | "system"
        | "course"
        | "exam"
        | "assignment"
        | "grade"
        | "message"
        | "attendance"
      question_difficulty: "easy" | "medium" | "hard"
      question_type:
        | "single_choice"
        | "multiple_choice"
        | "true_false"
        | "short_answer"
        | "essay"
      request_status: "pending" | "approved" | "rejected"
      submission_status: "submitted" | "graded" | "returned" | "late"
      user_role: "admin" | "teacher" | "student"
      violation_severity: "low" | "medium" | "high" | "critical"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "pending"],
      attempt_status: ["in_progress", "submitted", "graded", "invalidated"],
      attendance_status: ["present", "absent", "late", "excused"],
      course_status: ["draft", "published", "archived"],
      enrollment_status: ["active", "completed", "dropped"],
      exam_status: ["draft", "published", "closed", "archived"],
      lesson_content_type: ["video", "article", "pdf", "presentation", "quiz"],
      notification_type: [
        "system",
        "course",
        "exam",
        "assignment",
        "grade",
        "message",
        "attendance",
      ],
      question_difficulty: ["easy", "medium", "hard"],
      question_type: [
        "single_choice",
        "multiple_choice",
        "true_false",
        "short_answer",
        "essay",
      ],
      request_status: ["pending", "approved", "rejected"],
      submission_status: ["submitted", "graded", "returned", "late"],
      user_role: ["admin", "teacher", "student"],
      violation_severity: ["low", "medium", "high", "critical"],
    },
  },
} as const

