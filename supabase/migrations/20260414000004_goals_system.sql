
-- Goals System Migration
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL DEFAULT 0,
    current_amount NUMERIC NOT NULL DEFAULT 0,
    deadline DATE,
    category TEXT DEFAULT 'Others',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own goals" 
    ON public.goals 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to contribute to a goal (for atomicity)
CREATE OR REPLACE FUNCTION contribute_to_goal(p_goal_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE public.goals 
    SET current_amount = current_amount + p_amount
    WHERE id = p_goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
