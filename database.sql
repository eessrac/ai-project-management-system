--
-- PostgreSQL database dump
--

\restrict xWY7SJx4stCewxkVoDFpb2prphbXcwz7hMXcgFOSfzG5Fy4f5hOdHQ7Y527BIab

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'SQL_ASCII';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_task_suggestions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_task_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    category character varying(50),
    priority character varying(20) DEFAULT 'MEDIUM'::character varying,
    estimated_hours integer,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    suggested_assignee_id uuid,
    suggested_assignee_reason text,
    estimated_days integer,
    start_date date,
    due_date date,
    suggested_dependency_ids uuid[] DEFAULT '{}'::uuid[],
    suggested_dependency_reason text,
    task_type character varying(30) DEFAULT 'FEATURE'::character varying,
    subtasks jsonb DEFAULT '[]'::jsonb,
    roadmap_order integer DEFAULT 1,
    acceptance_criteria jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.ai_task_suggestions OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title text NOT NULL,
    body text,
    project_id uuid,
    task_id uuid,
    comment_id uuid,
    triggered_by uuid,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: project_join_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_join_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    join_code character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_join_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE public.project_join_requests OWNER TO postgres;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_members (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_members_role_check CHECK (((role)::text = ANY ((ARRAY['LEADER'::character varying, 'MEMBER'::character varying])::text[])))
);


ALTER TABLE public.project_members OWNER TO postgres;

--
-- Name: project_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.project_messages OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    join_code character varying(12) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp without time zone,
    archived_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sprint_duration_days integer DEFAULT 14 NOT NULL,
    color character varying(20) DEFAULT '#4F46E5'::character varying NOT NULL,
    template_type character varying(50) DEFAULT 'blank'::character varying,
    CONSTRAINT projects_color_check CHECK (((color)::text ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT projects_sprint_duration_check CHECK (((sprint_duration_days >= 1) AND (sprint_duration_days <= 60)))
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: sprint_ai_analyses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprint_ai_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    sprint_id uuid NOT NULL,
    archive_id uuid,
    analysis jsonb NOT NULL,
    generated_by uuid,
    model_name character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sprint_ai_analyses OWNER TO postgres;

--
-- Name: sprint_archive_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprint_archive_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_task_id uuid NOT NULL,
    original_log_id uuid,
    actor_id uuid,
    actor_name text,
    action text,
    message text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone,
    snapshotted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sprint_archive_activities OWNER TO postgres;

--
-- Name: sprint_archive_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprint_archive_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_task_id uuid NOT NULL,
    original_comment_id uuid,
    author_id uuid,
    author_name text,
    body text NOT NULL,
    created_at timestamp with time zone,
    snapshotted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sprint_archive_comments OWNER TO postgres;

--
-- Name: sprint_archive_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprint_archive_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    archive_id uuid NOT NULL,
    original_task_id uuid,
    project_id uuid NOT NULL,
    sprint_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status text NOT NULL,
    priority text,
    due_date date,
    assigned_to uuid,
    assigned_to_name text,
    created_by uuid,
    created_by_name text,
    comment_count integer DEFAULT 0 NOT NULL,
    activity_count integer DEFAULT 0 NOT NULL,
    original_created_at timestamp with time zone,
    original_updated_at timestamp with time zone,
    snapshotted_at timestamp with time zone DEFAULT now() NOT NULL,
    estimated_cost numeric(12,2),
    actual_cost numeric(12,2),
    cost_note text
);


ALTER TABLE public.sprint_archive_tasks OWNER TO postgres;

--
-- Name: sprint_archives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprint_archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sprint_id uuid NOT NULL,
    project_id uuid NOT NULL,
    sprint_name text NOT NULL,
    start_date date,
    end_date date,
    closed_at timestamp with time zone DEFAULT now() NOT NULL,
    total_task_count integer DEFAULT 0 NOT NULL,
    done_task_count integer DEFAULT 0 NOT NULL,
    todo_task_count integer DEFAULT 0 NOT NULL,
    in_progress_task_count integer DEFAULT 0 NOT NULL,
    overdue_task_count integer DEFAULT 0 NOT NULL,
    completion_rate numeric(5,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sprint_archives OWNER TO postgres;

--
-- Name: sprints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sprints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'PLANNED'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sprint_date_check CHECK ((end_date >= start_date)),
    CONSTRAINT sprint_status_check CHECK ((status = ANY (ARRAY['PLANNED'::text, 'ACTIVE'::text, 'DONE'::text])))
);


ALTER TABLE public.sprints OWNER TO postgres;

--
-- Name: task_assignees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_assignees (
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_assignees OWNER TO postgres;

--
-- Name: task_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid,
    uploaded_by uuid,
    original_name text NOT NULL,
    file_name text NOT NULL,
    mime_type text,
    size_bytes integer,
    file_path text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.task_attachments OWNER TO postgres;

--
-- Name: task_code_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_code_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(50),
    mime_type character varying(100),
    code_content text NOT NULL,
    description text,
    ai_summary text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    version_no integer DEFAULT 1,
    ai_commit_summary text
);


ALTER TABLE public.task_code_submissions OWNER TO postgres;

--
-- Name: task_comment_mentions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comment_mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    mentioned_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_comment_mentions OWNER TO postgres;

--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_comments OWNER TO postgres;

--
-- Name: task_dependencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_dependencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid NOT NULL,
    depends_on_task_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT no_self_dependency CHECK ((task_id <> depends_on_task_id))
);


ALTER TABLE public.task_dependencies OWNER TO postgres;

--
-- Name: task_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    task_id uuid,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    message text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.task_logs OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'TODO'::text NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    priority character varying(10) DEFAULT 'MEDIUM'::character varying,
    due_date date,
    assigned_to uuid,
    sprint_id uuid,
    estimated_cost numeric(12,2) DEFAULT 0,
    actual_cost numeric(12,2),
    cost_note text,
    start_date date,
    subtasks jsonb DEFAULT '[]'::jsonb,
    acceptance_criteria jsonb DEFAULT '[]'::jsonb,
    category text DEFAULT 'Genel'::text,
    task_type text,
    CONSTRAINT task_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying])::text[]))),
    CONSTRAINT task_status_check CHECK ((status = ANY (ARRAY['TODO'::text, 'IN_PROGRESS'::text, 'DONE'::text]))),
    CONSTRAINT tasks_actual_cost_nonnegative CHECK (((actual_cost IS NULL) OR (actual_cost >= (0)::numeric))),
    CONSTRAINT tasks_estimated_cost_nonnegative CHECK (((estimated_cost IS NULL) OR (estimated_cost >= (0)::numeric)))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(120) NOT NULL,
    email character varying(120) NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bio text,
    title text,
    avatar_url text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: ai_task_suggestions ai_task_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_task_suggestions
    ADD CONSTRAINT ai_task_suggestions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: project_join_requests project_join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_join_requests
    ADD CONSTRAINT project_join_requests_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: project_messages project_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_messages_pkey PRIMARY KEY (id);


--
-- Name: projects projects_join_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_join_code_key UNIQUE (join_code);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: sprint_ai_analyses sprint_ai_analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_ai_analyses
    ADD CONSTRAINT sprint_ai_analyses_pkey PRIMARY KEY (id);


--
-- Name: sprint_ai_analyses sprint_ai_analyses_project_id_sprint_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_ai_analyses
    ADD CONSTRAINT sprint_ai_analyses_project_id_sprint_id_key UNIQUE (project_id, sprint_id);


--
-- Name: sprint_archive_activities sprint_archive_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archive_activities
    ADD CONSTRAINT sprint_archive_activities_pkey PRIMARY KEY (id);


--
-- Name: sprint_archive_comments sprint_archive_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archive_comments
    ADD CONSTRAINT sprint_archive_comments_pkey PRIMARY KEY (id);


--
-- Name: sprint_archive_tasks sprint_archive_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archive_tasks
    ADD CONSTRAINT sprint_archive_tasks_pkey PRIMARY KEY (id);


--
-- Name: sprint_archives sprint_archives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archives
    ADD CONSTRAINT sprint_archives_pkey PRIMARY KEY (id);


--
-- Name: sprint_archives sprint_archives_sprint_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archives
    ADD CONSTRAINT sprint_archives_sprint_id_key UNIQUE (sprint_id);


--
-- Name: sprints sprints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprints
    ADD CONSTRAINT sprints_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_pkey PRIMARY KEY (task_id, user_id);


--
-- Name: task_attachments task_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_pkey PRIMARY KEY (id);


--
-- Name: task_code_submissions task_code_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_code_submissions
    ADD CONSTRAINT task_code_submissions_pkey PRIMARY KEY (id);


--
-- Name: task_comment_mentions task_comment_mentions_comment_id_mentioned_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_comment_id_mentioned_user_id_key UNIQUE (comment_id, mentioned_user_id);


--
-- Name: task_comment_mentions task_comment_mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (id);


--
-- Name: task_logs task_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies unique_task_dependency; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT unique_task_dependency UNIQUE (task_id, depends_on_task_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_notifications_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_project ON public.notifications USING btree (project_id);


--
-- Name: idx_notifications_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_task ON public.notifications USING btree (task_id);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_project_join_requests_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_join_requests_project_id ON public.project_join_requests USING btree (project_id);


--
-- Name: idx_project_join_requests_requester_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_join_requests_requester_id ON public.project_join_requests USING btree (requester_id);


--
-- Name: idx_project_join_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_join_requests_status ON public.project_join_requests USING btree (status);


--
-- Name: idx_project_messages_project_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_messages_project_time ON public.project_messages USING btree (project_id, created_at);


--
-- Name: idx_sprints_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sprints_project ON public.sprints USING btree (project_id);


--
-- Name: idx_sprints_project_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sprints_project_status ON public.sprints USING btree (project_id, status);


--
-- Name: idx_task_assignees_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_assignees_task_id ON public.task_assignees USING btree (task_id);


--
-- Name: idx_task_assignees_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_assignees_user_id ON public.task_assignees USING btree (user_id);


--
-- Name: idx_task_comment_mentions_comment_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_comment_mentions_comment_id ON public.task_comment_mentions USING btree (comment_id);


--
-- Name: idx_task_comment_mentions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_comment_mentions_user_id ON public.task_comment_mentions USING btree (mentioned_user_id);


--
-- Name: idx_task_comments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_comments_created_at ON public.task_comments USING btree (created_at);


--
-- Name: idx_task_comments_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_comments_project_id ON public.task_comments USING btree (project_id);


--
-- Name: idx_task_comments_task_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_comments_task_id ON public.task_comments USING btree (task_id);


--
-- Name: idx_task_logs_project_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_logs_project_time ON public.task_logs USING btree (project_id, created_at DESC);


--
-- Name: idx_task_logs_task_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_logs_task_time ON public.task_logs USING btree (task_id, created_at DESC);


--
-- Name: idx_tasks_sprint; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_sprint ON public.tasks USING btree (sprint_id);


--
-- Name: uniq_sprint_project_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_sprint_project_start ON public.sprints USING btree (project_id, start_date);


--
-- Name: uq_project_join_requests_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_project_join_requests_pending ON public.project_join_requests USING btree (project_id, requester_id) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: ux_projects_join_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ux_projects_join_code ON public.projects USING btree (join_code);


--
-- Name: ai_task_suggestions ai_task_suggestions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_task_suggestions
    ADD CONSTRAINT ai_task_suggestions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ai_task_suggestions ai_task_suggestions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_task_suggestions
    ADD CONSTRAINT ai_task_suggestions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: ai_task_suggestions ai_task_suggestions_suggested_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_task_suggestions
    ADD CONSTRAINT ai_task_suggestions_suggested_assignee_id_fkey FOREIGN KEY (suggested_assignee_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.task_comments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_join_requests project_join_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_join_requests
    ADD CONSTRAINT project_join_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_join_requests project_join_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_join_requests
    ADD CONSTRAINT project_join_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_join_requests project_join_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_join_requests
    ADD CONSTRAINT project_join_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_messages project_messages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_messages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_messages project_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_messages
    ADD CONSTRAINT project_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sprint_ai_analyses sprint_ai_analyses_archive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_ai_analyses
    ADD CONSTRAINT sprint_ai_analyses_archive_id_fkey FOREIGN KEY (archive_id) REFERENCES public.sprint_archives(id) ON DELETE CASCADE;


--
-- Name: sprint_ai_analyses sprint_ai_analyses_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_ai_analyses
    ADD CONSTRAINT sprint_ai_analyses_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sprint_ai_analyses sprint_ai_analyses_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_ai_analyses
    ADD CONSTRAINT sprint_ai_analyses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sprint_ai_analyses sprint_ai_analyses_sprint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_ai_analyses
    ADD CONSTRAINT sprint_ai_analyses_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES public.sprints(id) ON DELETE CASCADE;


--
-- Name: sprint_archive_activities sprint_archive_activities_archive_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archive_activities
    ADD CONSTRAINT sprint_archive_activities_archive_task_id_fkey FOREIGN KEY (archive_task_id) REFERENCES public.sprint_archive_tasks(id) ON DELETE CASCADE;


--
-- Name: sprint_archive_comments sprint_archive_comments_archive_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archive_comments
    ADD CONSTRAINT sprint_archive_comments_archive_task_id_fkey FOREIGN KEY (archive_task_id) REFERENCES public.sprint_archive_tasks(id) ON DELETE CASCADE;


--
-- Name: sprint_archive_tasks sprint_archive_tasks_archive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprint_archive_tasks
    ADD CONSTRAINT sprint_archive_tasks_archive_id_fkey FOREIGN KEY (archive_id) REFERENCES public.sprint_archives(id) ON DELETE CASCADE;


--
-- Name: sprints sprints_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprints
    ADD CONSTRAINT sprints_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sprints sprints_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sprints
    ADD CONSTRAINT sprints_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_attachments task_attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: task_attachments task_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: task_code_submissions task_code_submissions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_code_submissions
    ADD CONSTRAINT task_code_submissions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_code_submissions task_code_submissions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_code_submissions
    ADD CONSTRAINT task_code_submissions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_code_submissions task_code_submissions_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_code_submissions
    ADD CONSTRAINT task_code_submissions_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_comment_mentions task_comment_mentions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.task_comments(id) ON DELETE CASCADE;


--
-- Name: task_comment_mentions task_comment_mentions_mentioned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_mentioned_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_depends_on_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_logs task_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_logs task_logs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_logs task_logs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_logs
    ADD CONSTRAINT task_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_sprint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES public.sprints(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict xWY7SJx4stCewxkVoDFpb2prphbXcwz7hMXcgFOSfzG5Fy4f5hOdHQ7Y527BIab

