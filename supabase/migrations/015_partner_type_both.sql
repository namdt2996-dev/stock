-- Migration: 015_partner_type_both
-- Thêm giá trị 'BOTH' vào enum partner_type (đối tác vừa là NCC vừa là KH).
-- Đã chạy thủ công trên Supabase Dashboard.

ALTER TYPE partner_type ADD VALUE IF NOT EXISTS 'BOTH';
