# Delete inventory documents

## Rules
- `draft` / `approved`: `inventory.receive` — hard delete lines + doc (no stock).
- `posted`: `inventory.adjust.approve` — reverse each movement’s delta on balances, delete movements + lines + doc. Reject if reverse would make on_hand < reserved or < 0.
- `void`: treat as already gone / 404.

## API
`DELETE /api/v1/admin/inventory/documents/:id`

## Admin UI
Delete button on Phiếu list + detail; confirm dialog; posted warns about stock reverse.
