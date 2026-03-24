import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ImageIcon, Film, Mic, Wrench, Clapperboard, UserCircle } from 'lucide-react';
import ImageStudio from './ImageStudio';
import VideoStudio from './VideoStudio';
import AnimateStudio from './AnimateStudio';
import LipSyncStudio from './LipSyncStudio';
import InfluencerStudio from './InfluencerStudio';
import ToolsStudio from './ToolsStudio';

type Tab = 'image' | 'video' | 'animate' | 'lipsync' | 'influencer' | 'tools';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'image', label: 'Image', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'video', label: 'Video', icon: <Film className="h-4 w-4" /> },
  { id: 'animate', label: 'Animate', icon: <Clapperboard className="h-4 w-4" /> },
  { id: 'lipsync', label: 'Lip Sync', icon: <Mic className="h-4 w-4" /> },
  { id: 'influencer', label: 'Influencer', icon: <UserCircle className="h-4 w-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="h-4 w-4" /> },
];

export default function StudioLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('image');
  const navigate = useNavigate();

  useEffect(() => {
    axios.post('/api/studio/warmup').catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/c/new')}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-lg font-bold text-transparent">
            KYNS Studio
          </h1>
        </div>
        {/* Tabs - Desktop */}
        <div className="hidden gap-1 sm:flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {/* Tabs - Mobile */}
      <div className="flex border-b border-white/10 sm:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-purple-500 text-purple-300'
                : 'text-gray-500'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'image' && <ImageStudio />}
        {activeTab === 'video' && <VideoStudio />}
        {activeTab === 'animate' && <AnimateStudio />}
        {activeTab === 'lipsync' && <LipSyncStudio />}
        {activeTab === 'influencer' && <InfluencerStudio />}
        {activeTab === 'tools' && <ToolsStudio />}
      </div>
    </div>
  );
}
