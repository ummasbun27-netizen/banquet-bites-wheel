UPDATE public.menu_items SET image = v.new_image FROM (VALUES
('/menu/085fa2dc-power.jpg','/menu/085fa2dc-power-studio.jpg'),
('/menu/0f3de69d-sauces.jpg','/menu/0f3de69d-sauces-studio.jpg'),
('/menu/209aa73b-strawberry-shake.jpg','/menu/209aa73b-strawberry-shake-studio.jpg'),
('/menu/28ba9a74-max.jpg','/menu/28ba9a74-max-studio.jpg'),
('/menu/5cbf0ef6-water-2.jpg','/menu/5cbf0ef6-water-2-studio.jpg'),
('/menu/5d924aed-chocolate-soup-clean.jpg','/menu/5d924aed-chocolate-soup-studio.jpg'),
('/menu/68a485a0-ummasbun-shake.jpg','/menu/68a485a0-ummasbun-shake-studio.jpg'),
('/menu/6e6fcce3-water-small.jpg','/menu/6e6fcce3-water-small-studio.jpg'),
('/menu/7b6ff50b-water-05.jpg','/menu/7b6ff50b-water-05-studio.jpg'),
('/menu/9d5c8b40-protein-drink-clean.jpg','/menu/9d5c8b40-protein-drink-studio.jpg'),
('/menu/9e941830-food-ta.jpg','/menu/9e941830-food-ta-studio.jpg'),
('/menu/a04b9f25-juice-cup.jpg','/menu/a04b9f25-juice-cup-studio.jpg'),
('/menu/c05ca5f4-coffee-cup.jpg','/menu/c05ca5f4-coffee-cup-studio.jpg'),
('/menu/e7023a22-water-1.jpg','/menu/e7023a22-water-1-studio.jpg'),
('/menu/eb6e89c2-bread.jpg','/menu/eb6e89c2-bread-studio.jpg')
) AS v(old_image, new_image)
WHERE public.menu_items.image = v.old_image;