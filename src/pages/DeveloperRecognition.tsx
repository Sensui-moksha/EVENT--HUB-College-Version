import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Code2,
  GithubIcon,
  LinkedinIcon,
  Mail,
  Award,
  Zap,
  Heart,
  Star,
  Target,
  Lightbulb,
  GitBranch,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const DeveloperRecognition: React.FC = () => {
  const [expandedDeveloper, setExpandedDeveloper] = useState<number | null>(null);

  const developers = [
    {
      id: 1,
      name: 'Lead Developer',
      role: 'Full Stack Architecture',
      skills: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'Tailwind CSS'],
      contributions: ['Core Architecture', 'API Design', 'Database Schema'],
      avatar: '👨‍💻',
      github: 'https://github.com',
      linkedin: 'https://linkedin.com',
      email: 'dev@example.com'
    },
    {
      id: 2,
      name: 'Frontend Specialist',
      role: 'UI/UX & Component Development',
      skills: ['React', 'Framer Motion', 'Tailwind CSS', 'TypeScript'],
      contributions: ['Component Library', 'Animation System', 'Responsive Design'],
      avatar: '🎨',
      github: 'https://github.com',
      linkedin: 'https://linkedin.com',
      email: 'frontend@example.com'
    },
    {
      id: 3,
      name: 'Backend Specialist',
      role: 'Server Logic & Database',
      skills: ['Node.js', 'Express', 'MongoDB', 'Authentication', 'API'],
      contributions: ['REST APIs', 'Database Optimization', 'Security'],
      avatar: '⚙️',
      github: 'https://github.com',
      linkedin: 'https://linkedin.com',
      email: 'backend@example.com'
    },
  ];

  const features = [
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'High Performance',
      description: 'Optimized for speed and responsiveness across all devices'
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: 'User Focused',
      description: 'Designed with user experience and accessibility in mind'
    },
    {
      icon: <Lightbulb className="w-8 h-8" />,
      title: 'Innovation',
      description: 'Built with latest technologies and best practices'
    },
    {
      icon: <GitBranch className="w-8 h-8" />,
      title: 'Clean Code',
      description: 'Maintainable, scalable, and well-documented codebase'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center justify-center w-16 h-16" >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg blur opacity-50"></div>
              <div className="relative bg-white p-3 rounded-lg">
                <Code2 className="w-10 h-10 text-blue-600" />
              </div>
            </div>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mt-6 mb-4"
          >
            Developer Recognition
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Meet the talented developers who built EventHub College with passion, skill, and dedication to excellence.
          </motion.p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -5 }}
              className="group bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200"
            >
              <div className="text-blue-600 mb-4 group-hover:text-purple-600 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Developers Section */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <motion.h2
            variants={itemVariants}
            className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12"
          >
            Meet Our Team
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {developers.map((developer, index) => (
              <motion.div
                key={developer.id}
                variants={itemVariants}
                className="group"
              >
                <motion.div
                  className="relative bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer"
                  onClick={() => setExpandedDeveloper(expandedDeveloper === index ? null : index)}
                  whileHover={{ y: -8 }}
                >
                  {/* Card Header with Gradient */}
                  <div className="h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="relative px-6 pb-6">
                    <motion.div
                      className="w-24 h-24 bg-white rounded-full shadow-lg border-4 border-gradient flex items-center justify-center text-5xl -mt-12 relative z-10"
                      whileHover={{ scale: 1.1 }}
                    >
                      {developer.avatar}
                    </motion.div>

                    {/* Developer Info */}
                    <div className="mt-4">
                      <h3 className="text-xl font-bold text-gray-900">{developer.name}</h3>
                      <p className="text-purple-600 font-semibold text-sm mt-1">{developer.role}</p>

                      {/* Skills */}
                      <motion.div
                        layout
                        className="mt-6 space-y-4"
                      >
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <Award className="w-4 h-4 mr-2 text-blue-600" />
                            Skills
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {developer.skills.map((skill, idx) => (
                              <motion.span
                                key={idx}
                                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
                                whileHover={{ scale: 1.05 }}
                              >
                                {skill}
                              </motion.span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <Star className="w-4 h-4 mr-2 text-purple-600" />
                            Contributions
                          </h4>
                          <div className="space-y-2">
                            {developer.contributions.map((contribution, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <ArrowRight className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-700">{contribution}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>

                      {/* Social Links */}
                      <motion.div
                        layout
                        className="mt-6 pt-6 border-t border-gray-200"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <motion.a
                            href={developer.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-gray-100 hover:bg-blue-100 rounded-lg transition-colors"
                            title="GitHub"
                          >
                            <GithubIcon className="w-5 h-5 text-gray-700 hover:text-blue-600" />
                          </motion.a>
                          <motion.a
                            href={developer.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-gray-100 hover:bg-blue-100 rounded-lg transition-colors"
                            title="LinkedIn"
                          >
                            <LinkedinIcon className="w-5 h-5 text-gray-700 hover:text-blue-600" />
                          </motion.a>
                          <motion.a
                            href={`mailto:${developer.email}`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-gray-100 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Email"
                          >
                            <Mail className="w-5 h-5 text-gray-700 hover:text-blue-600" />
                          </motion.a>
                        </div>
                      </motion.div>

                      {/* Expand Indicator */}
                      <motion.button
                        className="w-full mt-4 py-2 text-center text-sm font-semibold text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                        onClick={() => setExpandedDeveloper(expandedDeveloper === index ? null : index)}
                      >
                        {expandedDeveloper === index ? (
                          <>
                            <span>Less Info</span>
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>More Info</span>
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tech Stack Section */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-20 bg-white rounded-2xl shadow-lg p-8 md:p-12 border border-gray-200"
        >
          <motion.h2
            variants={itemVariants}
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-8 text-center"
          >
            Built With Modern Tech Stack
          </motion.h2>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {[
              { name: 'React (TypeScript)', icon: '⚛️' },
              { name: 'Tailwind CSS', icon: '🎨' },
              { name: 'Framer Motion', icon: '✨' },
              { name: 'Node.js', icon: '🟢' },
              { name: 'Express', icon: '🚀' },
              { name: 'MongoDB', icon: '🍃' },
              { name: 'JWT Auth', icon: '🔐' },
              { name: 'Vite', icon: '⚡' },
            ].map((tech, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -5, scale: 1.05 }}
                className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 hover:border-purple-300 transition-all"
              >
                <span className="text-3xl mb-3">{tech.icon}</span>
                <p className="text-center text-sm font-semibold text-gray-800">{tech.name}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-16 text-center"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <Heart className="w-5 h-5" />
            <span>Made with passion for EventHub</span>
            <Zap className="w-5 h-5" />
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-gray-600 mt-6 max-w-2xl mx-auto"
          >
            EventHub is powered by a dedicated team of developers committed to delivering excellence. Thank you for using our platform! 🎉
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DeveloperRecognition;
