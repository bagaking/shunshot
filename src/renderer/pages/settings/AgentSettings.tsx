import React from 'react';
import { AgentList } from '../../components/AgentList';

export const AgentSettings: React.FC = () => {
  return (
    <div className="h-full overflow-auto">
      <AgentList />
    </div>
  );
}; 