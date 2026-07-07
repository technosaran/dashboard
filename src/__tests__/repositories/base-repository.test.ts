import { describe, it, expect, vi, beforeEach } from "vitest";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { SupabaseRepository } from "@/repositories/base-repository";
import { DatabaseError } from "@/lib/errors";

// Dummy repository to test the abstract class
class TestRepository extends SupabaseRepository<any> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, "test_table");
  }
}

describe("SupabaseRepository", () => {
  let mockSupabase: any;
  let repo: TestRepository;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };

    repo = new TestRepository(mockSupabase as any);
  });

  it("should find records by ID successfully", async () => {
    const mockRecord = { id: "123", name: "Test" };
    mockSupabase.maybeSingle.mockResolvedValue({ data: mockRecord, error: null });

    const result = await repo.findById("123");
    
    expect(result).toEqual(mockRecord);
    expect(mockSupabase.from).toHaveBeenCalledWith("test_table");
    expect(mockSupabase.eq).toHaveBeenCalledWith("id", "123");
  });

  it("should throw DatabaseError if findById query fails", async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: { message: "Query failed" } });

    await expect(repo.findById("123")).rejects.toThrow(DatabaseError);
  });

  it("should find all records matching query filters", async () => {
    const mockRecords = [{ id: "1" }, { id: "2" }];
    mockSupabase.range.mockResolvedValue({ data: mockRecords, error: null });

    const result = await repo.findAll({
      where: { active: true },
      orderBy: [{ field: "name", direction: "asc" }],
      offset: 0,
      limit: 10,
    });

    expect(result).toEqual(mockRecords);
    expect(mockSupabase.eq).toHaveBeenCalledWith("active", true);
    expect(mockSupabase.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(mockSupabase.range).toHaveBeenCalledWith(0, 9);
  });

  it("should insert record successfully", async () => {
    const mockRecord = { name: "New Item" };
    const mockResult = { id: "1", ...mockRecord };
    mockSupabase.single.mockResolvedValue({ data: mockResult, error: null });

    const result = await repo.create(mockRecord);

    expect(result).toEqual(mockResult);
    expect(mockSupabase.insert).toHaveBeenCalledWith(mockRecord);
  });

  it("should delete record successfully", async () => {
    mockSupabase.delete.mockReturnThis();
    mockSupabase.eq.mockResolvedValue({ error: null });

    const result = await repo.delete("123");

    expect(result).toBe(true);
    expect(mockSupabase.delete).toHaveBeenCalled();
    expect(mockSupabase.eq).toHaveBeenCalledWith("id", "123");
  });
});
