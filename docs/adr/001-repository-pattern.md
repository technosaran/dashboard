# Architectural Decision Record (ADR) 001: Adopting the Repository Pattern

## Status
Approved

## Context
In the initial implementation of the FinanceOS dashboard, database queries and Supabase CRUD actions were executed directly inside Next.js components, route handlers, and API endpoints. This approach resulted in tight coupling between our user interface layer, business logic, and the Supabase PostgreSQL database schema.

Tight coupling introduced several challenges:
- **Testability**: Unit testing components or business logic was difficult since we couldn't easily mock the global Supabase client or DB operations without mocking the entire network client.
- **Maintainability**: If the database schema changed, we had to modify SQL queries and Drizzle/Supabase calls across multiple client components and endpoints.
- **Portability**: Transitioning away from Supabase or swapping the database client in the future would require massive refactoring of UI and API code.

## Decision
We decided to adopt the Repository Pattern to abstract data access behind a defined interface boundary.
- All CRUD and querying operations for a data model are defined in a clean, language-level Interface.
- We implemented a generic base `SupabaseRepository` abstract class that implements common CRUD operations using the Supabase client.
- Model-specific repositories (e.g. `TransactionRepository`, `AccountRepository`, `BudgetRepository`, `InvestmentRepository`) inherit the base repository and add domain-specific query methods.
- The repository classes throw clean, domain-specific `DatabaseError` objects rather than leaking low-level PostgreSQL or network errors.

## Consequences
- **Loose Coupling**: Components and service layers now depend on the repository interfaces, isolating them from data layer implementation details.
- **Unit Testability**: We can easily mock repositories using standard Vitest mock structures.
- **Strong Typing**: Typings are mapped directly to database type models in repository query results, enhancing strict compile checking.
