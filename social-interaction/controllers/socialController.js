const mongoose = require('mongoose');
const Post = require('../models/postModel');
const FriendRequest = require('../models/friendRequestModel');
const Chat = require('../models/chatModel');
const Group = require('../models/groupModel');
const User = require('../../user-management/models/userModel');
const { validationResult } = require('express-validator');
const Friend = require('../models/friendModel');
const amqp = require('amqplib');

// Fetch all posts
exports.getPosts = async (req, res, next) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

// Create a new post
exports.createPost = async (req, res, next) => {
  try {
    const { content } = req.body;
    const post = new Post({ content, author: req.user.name });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
};

// Send a friend request
exports.sendFriendRequest = async (req, res, next) => {
  try {
    const { receiver_id } = req.body;
    const sender_id = req.user.id;

    if (sender_id === receiver_id) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself.' });
    }

    const existingRequest = await FriendRequest.findOne({ sender_id, receiver_id });
    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent.' });
    }

    const newRequest = await FriendRequest.create({ sender_id, receiver_id });
    res.status(201).json(newRequest);
  } catch (error) {
    next(error);
  }
};

// Accept a friend request
exports.acceptFriendRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receiver_id = req.user.id;

    const request = await FriendRequest.findOne({ _id: id, receiver_id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found.' });
    }

    request.status = 'accepted';
    await request.save();

    await Friend.create([
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id },
    ]);

    res.status(200).json({ message: 'Friend request accepted.' });
  } catch (error) {
    next(error);
  }
};

// Reject a friend request
exports.rejectFriendRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receiver_id = req.user.id;

    const request = await FriendRequest.findOne({ _id: id, receiver_id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found.' });
    }

    request.status = 'rejected';
    await request.save();

    res.status(200).json({ message: 'Friend request rejected.' });
  } catch (error) {
    next(error);
  }
};

// List friends
exports.listFriends = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const friends = await Friend.find({ user_id }).populate('friend_id', 'name email');
    res.status(200).json(friends);
  } catch (error) {
    next(error);
  }
};

// Fetch chat messages between two users
exports.getChatMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const chat = await Chat.findOne({
      participants: { $all: [req.user.id, userId] },
    }).populate('messages.sender', 'name');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    res.status(200).json(chat.messages);
  } catch (err) {
    next(err);
  }
};

// Send a chat message
exports.sendChatMessage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;

    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, userId] },
    });

    if (!chat) {
      chat = new Chat({ participants: [req.user.id, userId], messages: [] });
    }

    const message = { sender: req.user.id, content };
    chat.messages.push(message);
    await chat.save();

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

// Send a chat message using a persistent message queue
exports.sendMessageWithQueue = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;

    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    const queue = 'chat_messages';

    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify({ sender: req.user.id, receiver: userId, content })), { persistent: true });

    res.status(200).json({ message: 'Message queued successfully' });
  } catch (error) {
    next(error);
  }
};

// Create a new group
exports.createGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const group = new Group({
      name,
      description,
      members: [req.user.id],
    });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
};

// Fetch group details
exports.getGroupDetails = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId).populate('members', 'name').populate('messages.sender', 'name');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.status(200).json(group);
  } catch (err) {
    next(err);
  }
};

// Complete the sendGroupMessage function
exports.sendGroupMessage = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const message = { sender: req.user.id, content };
    group.messages.push(message);
    await group.save();

    res.status(201).json({ message: 'Message sent successfully', message });
  } catch (err) {
    next(err);
  }
};

// Fetch suggested friends
exports.getSuggestedFriends = async (req, res, next) => {
  try {
    // Fetch mutual connections
    const user = await User.findById(req.user.id).populate('friends');
    const mutualConnections = await User.find({
      _id: { $nin: [req.user.id, ...user.friends.map((friend) => friend._id)] },
      friends: { $in: user.friends.map((friend) => friend._id) },
    }).limit(5);

    // Fetch users with common interests (e.g., shared groups)
    const sharedGroups = await User.find({
      _id: { $nin: [req.user.id, ...user.friends.map((friend) => friend._id)] },
      groups: { $in: user.groups },
    }).limit(5);

    const suggestedFriends = [...new Set([...mutualConnections, ...sharedGroups])];

    res.status(200).json(suggestedFriends);
  } catch (err) {
    next(err);
  }
};

// Report abusive content
exports.reportContent = async (req, res, next) => {
  try {
    const { contentId, reason } = req.body;
    const userId = req.user.id;

    const report = await Report.create({
      contentId,
      reason,
      reportedBy: userId,
    });

    res.status(201).json({ message: 'Content reported successfully', report });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPosts,
  createPost,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  listFriends,
  getChatMessages,
  sendChatMessage,
  sendMessageWithQueue,
  createGroup,
  getGroupDetails,
  sendGroupMessage,
  getSuggestedFriends,
  reportContent,
};
