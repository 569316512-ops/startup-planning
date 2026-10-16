import {sql} from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey,index,uniqueIndex } from 'drizzle-orm/sqlite-core';
export const users = sqliteTable('users', {
 id:text('id').primaryKey(),email:text('email').notNull().unique(),passwordHash:text('password_hash').notNull(),salt:text('salt').notNull(),profile:text('profile').notNull(),contact:text('contact').notNull(),memberUntil:text('member_until'),role:text('role').notNull().default('member'),suspended:integer('suspended').notNull().default(0),createdAt:text('created_at').notNull(),
});
export const sessions = sqliteTable('sessions',{tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),expiresAt:text('expires_at').notNull()});
export const posts = sqliteTable('posts',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull().references(()=>users.id),kind:text('kind').notNull(),status:text('status').notNull().default('active'),city:text('city').notNull().default('贵阳'),district:text('district').notNull(),price:integer('price').notNull(),data:text('data').notNull(),promotedUntil:text('promoted_until'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()});
export const interests = sqliteTable('interests',{postId:text('post_id').notNull().references(()=>posts.id),userId:text('user_id').notNull().references(()=>users.id),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.postId,t.userId]})]);
export const favorites = sqliteTable('favorites',{postId:text('post_id').notNull().references(()=>posts.id),userId:text('user_id').notNull().references(()=>users.id),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.postId,t.userId]})]);
export const conversations = sqliteTable('conversations',{id:text('id').primaryKey(),a:text('a').notNull().references(()=>users.id),b:text('b').notNull().references(()=>users.id),postId:text('post_id'),createdAt:text('created_at').notNull()});
export const messages = sqliteTable('messages',{id:text('id').primaryKey(),conversationId:text('conversation_id').notNull().references(()=>conversations.id),senderId:text('sender_id').notNull().references(()=>users.id),content:text('content').notNull(),createdAt:text('created_at').notNull(),readAt:text('read_at')});
export const searches = sqliteTable('searches',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),name:text('name').notNull(),filters:text('filters').notNull(),createdAt:text('created_at').notNull()});
export const reports = sqliteTable('reports',{id:text('id').primaryKey(),reporterId:text('reporter_id').notNull().references(()=>users.id),postId:text('post_id').notNull().references(()=>posts.id),reason:text('reason').notNull(),status:text('status').notNull().default('open'),createdAt:text('created_at').notNull()});
export const verifications = sqliteTable('verifications',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),kind:text('kind').notNull(),status:text('status').notNull().default('pending'),note:text('note').notNull(),createdAt:text('created_at').notNull()});
export const orders = sqliteTable('orders',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),postId:text('post_id').notNull(),plan:text('plan').notNull(),amount:integer('amount').notNull(),status:text('status').notNull().default('awaiting_provider'),createdAt:text('created_at').notNull()});
export const blocks = sqliteTable('blocks',{userId:text('user_id').notNull().references(()=>users.id),targetId:text('target_id').notNull().references(()=>users.id)},t=>[primaryKey({columns:[t.userId,t.targetId]})]);
export const rateLimits = sqliteTable('rate_limits',{key:text('key').primaryKey(),hits:integer('hits').notNull(),until:text('until').notNull()});

// Private pilot intake and first-party session-level funnel events.
export const pilotLeads=sqliteTable('pilot_leads',{
 id:text('id').primaryKey(),receiptHash:text('receipt_hash').notNull().unique(),sessionId:text('session_id').notNull(),kind:text('kind').notNull(),city:text('city').notNull(),district:text('district').notNull(),budget:integer('budget').notNull(),moveIn:text('move_in').notNull(),minLeaseMonths:integer('min_lease_months'),preferredGender:text('preferred_gender').notNull().default('不限'),note:text('note').notNull(),personalIntro:text('personal_intro').notNull().default(''),coRentalRules:text('co_rental_rules').notNull().default(''),roommateExpectations:text('roommate_expectations').notNull().default(''),housing:text('housing').notNull().default('{}'),photoIds:text('photo_ids').notNull().default('[]'),nickname:text('nickname').notNull(),occupation:text('occupation').notNull().default(''),title:text('title').notNull().default(''),gender:text('gender').notNull().default('未公开'),avatar:text('avatar').notNull().default(''),userId:text('user_id'),contactType:text('contact_type').notNull(),contactValue:text('contact_value').notNull(),contactVisibility:text('contact_visibility').notNull().default('operator'),source:text('source').notNull(),status:text('status').notNull().default('new'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
});
export const pilotEvents=sqliteTable('pilot_events',{
 id:text('id').primaryKey(),sessionId:text('session_id').notNull(),event:text('event').notNull(),city:text('city').notNull(),source:text('source').notNull(),createdAt:text('created_at').notNull()
});

export const pilotUploads=sqliteTable('pilot_uploads',{
 id:text('id').primaryKey(),receiptHash:text('receipt_hash').notNull(),objectKey:text('object_key').notNull(),contentType:text('content_type').notNull(),createdAt:text('created_at').notNull()
});

// No contact values or receipt credentials are kept in disclosure history.
export const contactViews=sqliteTable('contact_views',{
 viewerId:text('viewer_id').notNull().references(()=>users.id),day:text('day').notNull(),targetHash:text('target_hash').notNull(),createdAt:text('created_at').notNull()
},t=>[primaryKey({columns:[t.viewerId,t.day,t.targetHash]})]);

export const publicationEvents=sqliteTable('publication_events',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),day:text('day').notNull(),createdAt:text('created_at').notNull()},t=>[index('publication_user_day').on(t.userId,t.day)]);
export const paymentChannels=sqliteTable('payment_channels',{channel:text('channel').primaryKey(),objectKey:text('object_key').notNull(),contentType:text('content_type').notNull(),updatedAt:text('updated_at').notNull()});
export const membershipOrders=sqliteTable('membership_orders',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),channel:text('channel').notNull(),amount:integer('amount').notNull().default(3000),status:text('status').notNull().default('awaiting_payment'),proofKey:text('proof_key'),proofType:text('proof_type'),reviewedBy:text('reviewed_by'),reviewedAt:text('reviewed_at'),note:text('note').notNull().default(''),createdAt:text('created_at').notNull()},t=>[uniqueIndex('membership_open_order').on(t.userId).where(sql`${t.status} IN ('awaiting_payment','pending_review')`)]);

// Quick posts have a separate lifecycle from ordinary posts; withdrawal cascades saves.
export const pilotFavorites=sqliteTable('pilot_favorites',{postId:text('post_id').notNull().references(()=>pilotLeads.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>users.id),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.postId,t.userId]})]);
