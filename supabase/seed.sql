-- ============================================================================
-- FantaFac Smart Production Assistant — Reproducible Seed Data (seed.sql)
-- ============================================================================

INSERT INTO production_lines (id, facility_id, name, description, target_units_per_hour, active)
VALUES
  ('LINE-PKG-01', 'FAC-NORTH-01', 'Line 1 — High-Speed Carton Packaging', 'Automated 5-station primary and secondary packaging line', 600, TRUE),
  ('LINE-PKG-02', 'FAC-NORTH-01', 'Line 2 — Multi-Pack Shrink & Palletizing', 'Secondary case packing and bulk shrink-wrapping line', 450, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, sku, name, category, standard_cycle_time_sec, units_per_case)
VALUES
  ('PROD-01', 'SKU-BEV-330-24', 'Sparkling Citrus 330ml 24-Pack Carton', 'Beverage Cartons', 5.5, 24),
  ('PROD-02', 'SKU-BEV-500-12', 'Electrolyte Hydration 500ml 12-Pack Case', 'Beverage Cartons', 6.0, 12),
  ('PROD-03', 'SKU-SNK-200-36', 'Artisan Oat Bar 36-Count Retail Display Box', 'Food Packaging', 7.2, 36),
  ('PROD-04', 'SKU-PHM-100-48', 'Sterile Blister Pack 48-Unit Shipper Case', 'Nutraceutical Packaging', 8.0, 48)
ON CONFLICT (id) DO NOTHING;

INSERT INTO machines (
  id, name, line_id, station_code, station_order, machine_type, status,
  capacity_per_hour, current_output, good_quantity, defect_quantity,
  downtime_minutes_today, data_source, standard_processing_time_sec, station_buffer_capacity, sop_code
)
VALUES
  ('MCH-STA-A', 'Infeed Rotary Collator A1', 'LINE-PKG-01', 'Station A', 1, 'Product Feeding', 'Running', 700, 1480, 1472, 8, 12, 'Simulation', 2.0, 6, 'SOP-PKG-101'),
  ('MCH-STA-B', 'Vision Checkweigher & Optical Inspector B1', 'LINE-PKG-01', 'Station B', 2, 'Quality Inspection', 'Running', 680, 1472, 1445, 27, 15, 'Simulation', 2.2, 5, 'SOP-QC-204'),
  ('MCH-STA-C', 'Servo Carton Erector C1', 'LINE-PKG-01', 'Station C', 3, 'Box Forming', 'Warning', 620, 1445, 1428, 17, 38, 'Simulation', 2.6, 5, 'SOP-PKG-308'),
  ('MCH-STA-D', 'Delta Pick-and-Place Case Packer D1', 'LINE-PKG-01', 'Station D', 4, 'Packing', 'Running', 650, 1428, 1418, 10, 18, 'Simulation', 2.4, 5, 'SOP-ROB-412'),
  ('MCH-STA-E', 'Hot-Melt Gluer & Case Sealer E1', 'LINE-PKG-01', 'Station E', 5, 'Sealing and Finished Goods', 'Running', 660, 1418, 1406, 12, 22, 'Simulation', 2.3, 6, 'SOP-PKG-515'),
  ('MCH-L2-A', 'Bulk De-palletizer & Infeed A2', 'LINE-PKG-02', 'Station A', 1, 'Product Feeding', 'Running', 500, 920, 912, 8, 10, 'Manual', 2.8, 5, 'SOP-PKG-102'),
  ('MCH-L2-B', 'Thermal Shrink Tunnel B2', 'LINE-PKG-02', 'Station B', 2, 'Sealing and Finished Goods', 'Maintenance', 460, 610, 594, 16, 95, 'Manual', 3.1, 4, 'SOP-THM-210')
ON CONFLICT (id) DO NOTHING;
