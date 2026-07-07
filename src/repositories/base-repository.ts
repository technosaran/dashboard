/**
 * Base Repository Interface and Abstract Supabase Repository Implementation.
 * Implements requirement 2.4 and 2.6: Repository pattern for data access.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { DatabaseError } from "@/lib/errors";

export interface QueryFilters {
  where?: Record<string, any>;
  orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
  limit?: number;
  offset?: number;
}

export interface Repository<T, ID extends string = string> {
  findById(id: ID): Promise<T | null>;
  findAll(filters?: QueryFilters): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
  count(filters?: QueryFilters): Promise<number>;
}

export abstract class SupabaseRepository<T, ID extends string = string> implements Repository<T, ID> {
  constructor(
    protected readonly supabase: SupabaseClient<Database>,
    protected readonly tableName: keyof Database["public"]["Tables"]
  ) {}

  /**
   * Finds a record by its unique ID.
   */
  public async findById(id: ID): Promise<T | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw new DatabaseError(error.message);
      return data as T | null;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Finds all records matching optional filters (where clauses, ordering, pagination).
   */
  public async findAll(filters?: QueryFilters): Promise<T[]> {
    try {
      let query = this.supabase.from(this.tableName).select("*");

      if (filters?.where) {
        Object.entries(filters.where).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            query = query.eq(key, val);
          }
        });
      }

      if (filters?.orderBy) {
        filters.orderBy.forEach(({ field, direction }) => {
          query = query.order(field, { ascending: direction === "asc" });
        });
      }

      if (filters?.offset !== undefined && filters?.limit !== undefined) {
        query = query.range(filters.offset, filters.offset + filters.limit - 1);
      } else if (filters?.limit !== undefined) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw new DatabaseError(error.message);
      return (data || []) as T[];
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Creates a new record.
   */
  public async create(data: Partial<T>): Promise<T> {
    try {
      const { data: inserted, error } = await this.supabase
        .from(this.tableName)
        .insert(data as any)
        .select("*")
        .single();

      if (error) throw new DatabaseError(error.message);
      return inserted as T;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Updates an existing record by ID.
   */
  public async update(id: ID, data: Partial<T>): Promise<T | null> {
    try {
      const { data: updated, error } = await this.supabase
        .from(this.tableName)
        .update(data as any)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw new DatabaseError(error.message);
      return updated as T | null;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Deletes a record by ID.
   */
  public async delete(id: ID): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq("id", id);

      if (error) throw new DatabaseError(error.message);
      return true;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }

  /**
   * Counts the total number of records matching filter criteria.
   */
  public async count(filters?: QueryFilters): Promise<number> {
    try {
      let query = this.supabase.from(this.tableName).select("*", { count: "exact", head: true });

      if (filters?.where) {
        Object.entries(filters.where).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            query = query.eq(key, val);
          }
        });
      }

      const { count, error } = await query;
      if (error) throw new DatabaseError(error.message);
      return count || 0;
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      throw new DatabaseError(err instanceof Error ? err.message : undefined);
    }
  }
}
