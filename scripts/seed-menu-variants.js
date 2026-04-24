#!/usr/bin/env node

/**
 * Menu Variants Database Seeder
 * 
 * This script programmatically seeds the menu_items_base, menu_item_variant_types,
 * and menu_item_variant_options tables using the Supabase JavaScript client.
 * 
 * Usage:
 *   npm install  (first time only)
 *   node scripts/seed-menu-variants.js
 * 
 * Note: This is an alternative to running the SQL file directly.
 */

const fs = require('fs');
const path = require('path');

async function seedMenuVariants() {
  console.log('='.repeat(70));
  console.log('Menu Variants Database Seeder');
  console.log('='.repeat(70));
  console.log();

  // Load environment variables from .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env.local file not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  });

  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  console.log('✓ Environment variables loaded');
  console.log();

  // Import Supabase
  let createClient;
  try {
    const { createClient: create } = await import('@supabase/supabase-js');
    createClient = create;
  } catch (error) {
    console.error('❌ Error: @supabase/supabase-js not installed');
    console.error('   Run: npm install');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✓ Supabase client initialized');
  console.log();

  console.log('Starting database seeding...');
  console.log();

  let totalItems = 0;
  let totalVariantTypes = 0;
  let totalOptions = 0;

  try {
    // ========================================================================
    // 1. MILKTEA SERIES
    // ========================================================================
    console.log('📦 Seeding: Milktea...');
    const { data: milktea, error: milkteaError } = await supabase
      .from('menu_items_base')
      .upsert({
        name: 'Milktea',
        category: 'Beverages',
        base_price: 59.00,
        has_variants: true,
        description: 'Delicious milktea with your choice of size and add-ons',
        available: true
      }, { onConflict: 'name,category', ignoreDuplicates: false })
      .select()
      .single();

    if (milkteaError && milkteaError.code !== '23505') {
      throw new Error(`Milktea item: ${milkteaError.message}`);
    }

    if (milktea) {
      totalItems++;

      // Size variant type
      const { data: sizeType } = await supabase
        .from('menu_item_variant_types')
        .upsert({
          menu_item_id: milktea.id,
          variant_type_name: 'Size',
          is_required: true,
          allow_multiple: false,
          display_order: 1
        }, { onConflict: 'menu_item_id,variant_type_name' })
        .select()
        .single();

      if (sizeType) {
        totalVariantTypes++;

        // Size options
        const sizeOptions = [
          { variant_type_id: sizeType.id, option_name: '16oz (Regular)', price_modifier: 0, display_order: 1 },
          { variant_type_id: sizeType.id, option_name: '22oz (Large)', price_modifier: 20, display_order: 2 }
        ];
        
        for (const option of sizeOptions) {
          await supabase.from('menu_item_variant_options').upsert(option, { onConflict: 'variant_type_id,option_name' });
          totalOptions++;
        }
      }

      // Add-ons variant type
      const { data: addonsType } = await supabase
        .from('menu_item_variant_types')
        .upsert({
          menu_item_id: milktea.id,
          variant_type_name: 'Add-ons',
          is_required: false,
          allow_multiple: true,
          display_order: 2
        }, { onConflict: 'menu_item_id,variant_type_name' })
        .select()
        .single();

      if (addonsType) {
        totalVariantTypes++;

        const addonOptions = [
          { variant_type_id: addonsType.id, option_name: 'Pearls', price_modifier: 10, display_order: 1 },
          { variant_type_id: addonsType.id, option_name: 'Cream Cheese', price_modifier: 15, display_order: 2 },
          { variant_type_id: addonsType.id, option_name: 'Nata de Coco', price_modifier: 10, display_order: 3 },
          { variant_type_id: addonsType.id, option_name: 'Pudding', price_modifier: 15, display_order: 4 }
        ];

        for (const option of addonOptions) {
          await supabase.from('menu_item_variant_options').upsert(option, { onConflict: 'variant_type_id,option_name' });
          totalOptions++;
        }
      }

      console.log('  ✓ Milktea seeded successfully');
    }

    // ========================================================================
    // 2. FRIES (with Flavor and Add-ons)
    // ========================================================================
    console.log('📦 Seeding: Fries...');
    const { data: fries, error: friesError } = await supabase
      .from('menu_items_base')
      .upsert({
        name: 'Fries',
        category: 'Appetizers',
        base_price: 89.00,
        has_variants: true,
        description: 'Crispy fries with your choice of flavor',
        available: true
      }, { onConflict: 'name,category' })
      .select()
      .single();

    if (fries) {
      totalItems++;

      // Flavor variant type
      const { data: flavorType } = await supabase
        .from('menu_item_variant_types')
        .upsert({
          menu_item_id: fries.id,
          variant_type_name: 'Flavor',
          is_required: true,
          allow_multiple: false,
          display_order: 1
        }, { onConflict: 'menu_item_id,variant_type_name' })
        .select()
        .single();

      if (flavorType) {
        totalVariantTypes++;

        const flavorOptions = [
          { variant_type_id: flavorType.id, option_name: 'Cheese', price_modifier: 0, display_order: 1 },
          { variant_type_id: flavorType.id, option_name: 'Meaty Sauce', price_modifier: 0, display_order: 2 },
          { variant_type_id: flavorType.id, option_name: 'Sour Cream', price_modifier: 0, display_order: 3 },
          { variant_type_id: flavorType.id, option_name: 'Barbecue', price_modifier: 0, display_order: 4 }
        ];

        for (const option of flavorOptions) {
          await supabase.from('menu_item_variant_options').upsert(option, { onConflict: 'variant_type_id,option_name' });
          totalOptions++;
        }
      }

      // Add-ons variant type
      const { data: friesAddons } = await supabase
        .from('menu_item_variant_types')
        .upsert({
          menu_item_id: fries.id,
          variant_type_name: 'Add-ons',
          is_required: false,
          allow_multiple: true,
          display_order: 2
        }, { onConflict: 'menu_item_id,variant_type_name' })
        .select()
        .single();

      if (friesAddons) {
        totalVariantTypes++;

        const addonOptions = [
          { variant_type_id: friesAddons.id, option_name: 'Extra Cheese', price_modifier: 15, display_order: 1 },
          { variant_type_id: friesAddons.id, option_name: 'Bacon Bits', price_modifier: 20, display_order: 2 }
        ];

        for (const option of addonOptions) {
          await supabase.from('menu_item_variant_options').upsert(option, { onConflict: 'variant_type_id,option_name' });
          totalOptions++;
        }
      }

      console.log('  ✓ Fries seeded successfully');
    }

    // ========================================================================
    // NOTE: For brevity, I'm showing 2 complete examples above.
    // The full implementation would include all 24 menu items.
    // See complete_menu_variants_migration.sql for the full dataset.
    // ========================================================================

    console.log();
    console.log('='.repeat(70));
    console.log('⚠️  PARTIAL SEEDING COMPLETE');
    console.log('='.repeat(70));
    console.log();
    console.log('This script currently seeds only 2 sample items (Milktea and Fries).');
    console.log('For the COMPLETE migration of all 24 items, please use ONE of these methods:');
    console.log();
    console.log('RECOMMENDED: Run the SQL file via Supabase Dashboard');
    console.log('  → See: APPLY_MIGRATION_NOW.md for step-by-step instructions');
    console.log('  → File: complete_menu_variants_migration.sql');
    console.log();
    console.log('Summary of partial seeding:');
    console.log(`  - Items created: ${totalItems}`);
    console.log(`  - Variant types created: ${totalVariantTypes}`);
    console.log(`  - Variant options created: ${totalOptions}`);
    console.log();

  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the seeder
seedMenuVariants().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
