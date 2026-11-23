-- Scan tag engine (Tom 2026-11-23): pipeline judgments need their own room.
-- Additive: replaces the room check with one that also allows 'pipeline'.
ALTER TABLE "ScanFinding" DROP CONSTRAINT "ScanFinding_room_check";
ALTER TABLE "ScanFinding" ADD CONSTRAINT "ScanFinding_room_check" CHECK ((room = ANY (ARRAY['phone'::text, 'inbox'::text, 'payments'::text, 'contracts'::text, 'non-inbox'::text, 'pipeline'::text])));
