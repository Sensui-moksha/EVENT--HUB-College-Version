import React from 'react';
import { motion } from 'framer-motion';
import CalendarComponent from '../components/Calendar';

const CalendarPage: React.FC = () => {
  return (
    <motion.div 
      className="pt-24"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <CalendarComponent />
    </motion.div>
  );
};

export default CalendarPage;
