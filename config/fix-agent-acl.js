#!/usr/bin/env node

/**
 * Fix agents that exist in MongoDB but have no ACL entries (so they don't appear in the UI).
 * Uses only mongoose + dotenv (no monorepo deps). Requires MONGO_URI in .env.
 *
 * 1. Connects to MongoDB
 * 2. Shows one existing ACL document (from an agent that has permissions, e.g. Luna) so you can verify format
 * 3. Finds agents that have author but no user ACL entry for resourceType 'agent'
 * 4. For each: creates two aclentries (AGENT owner + REMOTE_AGENT owner) using roles from accessroles collection
 *
 * Usage: node config/fix-agent-acl.js [--dry-run] [--show-only]
 *   --show-only  Only print one example ACL doc from your DB (e.g. from Luna) and exit (no fixes)
 *   --dry-run    List agents that would get ACL, don't insert
 *
 * Run with --show-only first to see the exact format of an existing ACL document (e.g. Luna).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');

const PrincipalType = { USER: 'user', PUBLIC: 'public' };
const PrincipalModel = { USER: 'User' };
const ResourceType = { AGENT: 'agent', REMOTE_AGENT: 'remoteAgent' };
const AccessRoleIds = { AGENT_OWNER: 'agent_owner', REMOTE_AGENT_OWNER: 'remoteAgent_owner' };

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
  }

  const showOnly = process.argv.includes('--show-only');
  const dryRun = process.argv.includes('--dry-run');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const aclentries = db.collection('aclentries');
  const accessroles = db.collection('accessroles');
  const agents = db.collection('agents');

  if (showOnly) {
    const example = await aclentries.findOne({
      resourceType: ResourceType.AGENT,
      principalType: PrincipalType.USER,
    });
    if (!example) {
      console.log('No existing ACL entry found for an agent (resourceType=agent, principalType=user).');
      console.log('Example format the script will create (ObjectIds as hex strings):');
      console.log(
        JSON.stringify(
          {
            principalType: 'user',
            principalId: '<ObjectId do user (author do agent)>',
            principalModel: 'User',
            resourceType: 'agent',
            resourceId: '<ObjectId do agent (_id)>',
            permBits: 15,
            roleId: '<ObjectId do role agent_owner da collection accessroles>',
            grantedBy: '<ObjectId do user>',
            grantedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    } else {
      const safe = { ...example };
      if (safe.principalId && safe.principalId.toHexString) safe.principalId = safe.principalId.toHexString();
      if (safe.resourceId && safe.resourceId.toHexString) safe.resourceId = safe.resourceId.toHexString();
      if (safe.roleId && safe.roleId.toHexString) safe.roleId = safe.roleId.toHexString();
      if (safe.grantedBy && safe.grantedBy.toHexString) safe.grantedBy = safe.grantedBy.toHexString();
      if (safe._id && safe._id.toHexString) safe._id = safe._id.toHexString();
      if (safe.grantedAt && safe.grantedAt.toISOString) safe.grantedAt = safe.grantedAt.toISOString();
      console.log('Example ACL document (existing entry for an agent, e.g. Luna):');
      console.log(JSON.stringify(safe, null, 2));
    }
    await mongoose.disconnect();
    return;
  }

  const agentOwnerRole = await accessroles.findOne({ accessRoleId: AccessRoleIds.AGENT_OWNER });
  const remoteOwnerRole = await accessroles.findOne({ accessRoleId: AccessRoleIds.REMOTE_AGENT_OWNER });
  if (!agentOwnerRole || !remoteOwnerRole) {
    console.error('Missing roles in accessroles. Need agent_owner and remoteAgent_owner.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const existingUserAclResourceIds = await aclentries
    .find({
      resourceType: ResourceType.AGENT,
      principalType: PrincipalType.USER,
    })
    .project({ resourceId: 1 })
    .toArray();
  const hasAclSet = new Set(existingUserAclResourceIds.map((e) => e.resourceId.toString()));

  const allAgentsWithAuthor = await agents
    .find({ author: { $exists: true, $ne: null } })
    .project({ _id: 1, id: 1, name: 1, author: 1 })
    .toArray();

  const toFix = allAgentsWithAuthor.filter((a) => !hasAclSet.has(a._id.toString()));
  if (toFix.length === 0) {
    console.log('No agents without ACL found.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${toFix.length} agent(s) without user ACL: ${toFix.map((a) => a.name || a.id).join(', ')}`);

  if (dryRun) {
    console.log('Dry run – no changes made.');
    await mongoose.disconnect();
    return;
  }

  let inserted = 0;
  for (const agent of toFix) {
    const authorId = agent.author instanceof mongoose.Types.ObjectId ? agent.author : new mongoose.Types.ObjectId(agent.author);
    const resourceId = agent._id;
    const now = new Date();

    const agentEntry = {
      principalType: PrincipalType.USER,
      principalId: authorId,
      principalModel: PrincipalModel.USER,
      resourceType: ResourceType.AGENT,
      resourceId,
      permBits: agentOwnerRole.permBits,
      roleId: agentOwnerRole._id,
      grantedBy: authorId,
      grantedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const remoteEntry = {
      principalType: PrincipalType.USER,
      principalId: authorId,
      principalModel: PrincipalModel.USER,
      resourceType: ResourceType.REMOTE_AGENT,
      resourceId,
      permBits: remoteOwnerRole.permBits,
      roleId: remoteOwnerRole._id,
      grantedBy: authorId,
      grantedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await aclentries.insertOne(agentEntry);
    await aclentries.insertOne(remoteEntry);
    inserted += 2;
    console.log(`  ACL created for agent "${agent.name || agent.id}" (author: ${authorId})`);
  }

  console.log(`Done. Inserted ${inserted} ACL entries for ${toFix.length} agents.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
