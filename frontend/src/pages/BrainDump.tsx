import { useState, useRef, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth-client';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { WhisperRecorder, transcribeWithWhisper } from '../utils/whisperApi';
import { 
  Brain, 
  Mic, 
  MicOff, 
  Zap, 
  Save, 
  Sparkles,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  Plus,
  Edit3,
  Check,
  X,
  Square,
  CheckSquare,
  Settings,
  Sun,
  Moon,
  Sunset
} from 'lucide-react';

interface WorkSchedule {
  type: 'traditional' | 'night' | 'evening' | 'early' | 'custom';
  startTime: string;
  endTime: string;
  peakHours: string[];
  breakTime?: string;
  timezone?: string;
}

interface ProcessedTask {
  id: string;
  title: string;
  description: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  estimatedHours: number;
  category: string;
  tags: string[];
  microTasks: string[];
  optimalTimeSlot?: string;
  energyLevel?: 'High' | 'Medium' | 'Low';
  focusType?: 'Deep Work' | 'Collaboration' | 'Administrative';
  suggestedDay?: 'Today' | 'Tomorrow' | 'This Week';
  selected?: boolean;
  isEditing?: boolean;
}

interface DailySchedule {
  totalEstimatedHours: number;
  workloadAssessment: 'Optimal' | 'Heavy' | 'Light';
  recommendedOrder: string[];
  timeBlocks: {
    time: string;
    taskId: string;
    rationale: string;
  }[];
}

export function BrainDump() {
  // const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedTasks, setProcessedTasks] = useState<ProcessedTask[]>([]);
  const [dailySchedule, setDailySchedule] = useState<DailySchedule | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [whisperRecorder, setWhisperRecorder] = useState<WhisperRecorder | null>(null);
  const [useWhisper, setUseWhisper] = useState(true);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: session } = useSession();
  console.log('Session:', session); // Keep session for future use

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  // Auto-save functionality
  useEffect(() => {
    if (content.trim()) {
      const timer = setTimeout(() => {
        setLastSaved(new Date());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [content]);

  // Initialize speech recognition systems
  useEffect(() => {
    // Initialize Whisper recorder
    const recorder = new WhisperRecorder();
    setWhisperRecorder(recorder);
    
    // Initialize browser speech recognition as fallback
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      let finalTranscript = '';
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Only add final results to content
        if (finalTranscript) {
          setContent(prev => {
            const newContent = prev + (prev.endsWith(' ') || !prev ? '' : ' ') + finalTranscript;
            finalTranscript = '';
            return newContent;
          });
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError('Voice recognition error. Please try again.');
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognition);
    }
  }, []);

  // Predefined schedule templates
  const scheduleTemplates: Record<string, WorkSchedule> = {
    traditional: {
      type: 'traditional',
      startTime: '9:00 AM',
      endTime: '5:00 PM',
      peakHours: ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'],
      breakTime: '12:00 PM - 1:00 PM'
    },
    night: {
      type: 'night',
      startTime: '9:00 PM',
      endTime: '5:00 AM',
      peakHours: ['10:00 PM - 12:00 AM', '2:00 AM - 4:00 AM'],
      breakTime: '12:30 AM - 1:30 AM'
    },
    evening: {
      type: 'evening',
      startTime: '2:00 PM',
      endTime: '10:00 PM',
      peakHours: ['3:00 PM - 5:00 PM', '7:00 PM - 9:00 PM'],
      breakTime: '5:30 PM - 6:30 PM'
    },
    early: {
      type: 'early',
      startTime: '5:00 AM',
      endTime: '1:00 PM',
      peakHours: ['6:00 AM - 8:00 AM', '10:00 AM - 12:00 PM'],
      breakTime: '8:30 AM - 9:30 AM'
    }
  };

  // Load saved work schedule on component mount
  useEffect(() => {
    const savedSchedule = localStorage.getItem('workSchedule');
    if (savedSchedule) {
      try {
        setWorkSchedule(JSON.parse(savedSchedule));
      } catch (error) {
        console.error('Failed to load work schedule:', error);
        // Default to traditional if loading fails
        setWorkSchedule(scheduleTemplates.traditional);
      }
    } else {
      // Default to traditional schedule
      setWorkSchedule(scheduleTemplates.traditional);
    }
  }, []);

  // Save work schedule to localStorage
  const saveWorkSchedule = (schedule: WorkSchedule) => {
    setWorkSchedule(schedule);
    localStorage.setItem('workSchedule', JSON.stringify(schedule));
  };

  // Get schedule icon
  const getScheduleIcon = (type: string) => {
    switch (type) {
      case 'traditional': return Sun;
      case 'night': return Moon;
      case 'evening': return Sunset;
      case 'early': return Sun;
      default: return Clock;
    }
  };

  // Get schedule display name
  const getScheduleDisplayName = (schedule: WorkSchedule) => {
    const typeNames = {
      traditional: 'Traditional (9 AM - 5 PM)',
      night: 'Night Shift (9 PM - 5 AM)',
      evening: 'Evening (2 PM - 10 PM)',
      early: 'Early Bird (5 AM - 1 PM)',
      custom: `Custom (${schedule.startTime} - ${schedule.endTime})`
    };
    return typeNames[schedule.type] || 'Custom Schedule';
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      setIsRecording(true);

      if (useWhisper && whisperRecorder) {
        console.log('🎤 Starting Whisper recording...');
        await whisperRecorder.startRecording();
      } else if (recognition) {
        console.log('🎤 Starting browser speech recognition...');
        recognition.start();
      } else {
        throw new Error('No voice recognition available');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start voice recording. Please check microphone permissions.');
      setIsRecording(false);
      
      // Fallback to browser recognition
      if (useWhisper && recognition) {
        setUseWhisper(false);
        try {
          recognition.start();
          setIsRecording(true);
        } catch (fallbackError) {
          console.error('Fallback recording failed:', fallbackError);
        }
      }
    }
  };

  const stopRecording = async () => {
    try {
      if (useWhisper && whisperRecorder?.isCurrentlyRecording()) {
        console.log('🎤 Stopping Whisper recording...');
        const audioBlob = await whisperRecorder.stopRecording();
        
        // Transcribe with Whisper API
        setError('Processing audio...');
        try {
          const result = await transcribeWithWhisper(audioBlob, {
            language: 'auto', // Let GPT-4o auto-detect language
            onFallback: () => {
              setUseWhisper(false);
              setError('Whisper unavailable, switched to browser recognition');
            }
          });
          
          // Add transcription to content
          setContent(prev => {
            const newContent = prev + (prev.endsWith(' ') || !prev ? '' : ' ') + result.transcription;
            return newContent;
          });
          
          setError('');
          console.log('✅ Whisper transcription completed');
        } catch (transcribeError) {
          console.warn('Whisper transcription failed:', transcribeError);
          setError('Transcription failed. Please try again or switch to browser recognition.');
        }
      } else if (recognition) {
        console.log('🎤 Stopping browser speech recognition...');
        recognition.stop();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to stop recording.');
    } finally {
      setIsRecording(false);
    }
  };

  const handleProcessDump = async () => {
    if (!content.trim()) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      // Call our backend API to process with OpenAI
      const response = await fetch('/api/ai/process-brain-dump', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: content.trim(),
          timestamp: new Date().toISOString(),
          preferences: {
            workingHours: { 
              start: workSchedule?.startTime || '9:00 AM', 
              end: workSchedule?.endTime || '5:00 PM' 
            },
            focusHours: workSchedule?.peakHours || ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'],
            breakInterval: 90, // minutes
            maxTasksPerDay: 6,
            prioritizeUrgent: true,
            scheduleType: workSchedule?.type || 'traditional',
            breakTime: workSchedule?.breakTime,
            timezone: workSchedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process brain dump');
      }

      const data = await response.json();
      const tasks = data.extractedTasks || [];
      const schedule = data.dailySchedule || null;
      
      // Convert server format to component format
      const formattedTasks: ProcessedTask[] = tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimatedHours: task.estimatedHours,
        category: task.category,
        tags: task.tags || [],
        microTasks: task.microTasks || [],
        optimalTimeSlot: task.optimalTimeSlot,
        energyLevel: task.energyLevel,
        focusType: task.focusType,
        suggestedDay: task.suggestedDay
      }));
      
      setProcessedTasks(formattedTasks);
      setDailySchedule(schedule);
      // Auto-select all tasks by default
      setSelectedTasks(new Set(formattedTasks.map(task => task.id)));
      
      if (formattedTasks.length > 0) {
        setError('');
      } else {
        setError('No tasks could be extracted from your input. Try being more specific about what needs to be done.');
      }
      
    } catch (error) {
      console.error('Brain dump processing failed:', error);
      setError('Processing failed. Please try again.');
      setProcessedTasks([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper functions for task management
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === processedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(processedTasks.map(task => task.id)));
    }
  };

  const updateTaskField = (taskId: string, field: keyof ProcessedTask, value: any) => {
    setProcessedTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, [field]: value } : task
    ));
  };

  const startEditing = (taskId: string) => {
    setEditingTask(taskId);
  };

  const stopEditing = () => {
    setEditingTask(null);
  };

  const handleSaveTasks = async () => {
    const selectedTasksList = processedTasks.filter(task => selectedTasks.has(task.id));
    if (!selectedTasksList.length || !session?.user?.id) {
      setError('Please select at least one task to import.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/brain-dump/save-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extractedTasks: selectedTasksList,
          dailySchedule: dailySchedule,
          userId: session.user.id,
          originalContent: content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save tasks');
      }

      await response.json();
      
      // Show success message and clear selections
      setLastSaved(new Date());
      setError(`Successfully imported ${selectedTasksList.length} tasks to your active task list!`);
      
      // Clear processed tasks after successful import
      setTimeout(() => {
        setProcessedTasks([]);
        setSelectedTasks(new Set());
        setDailySchedule(null);
        setError('');
      }, 3000);
      
      // Optionally navigate to tasks page to see the created tasks
      // setTimeout(() => {
      //   navigate('/tasks');
      // }, 2000);

    } catch (error) {
      console.error('Save tasks failed:', error);
      setError('Failed to save tasks. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'text-error';
      case 'High': return 'text-error';
      case 'Medium': return 'text-warning';
      case 'Low': return 'text-info';
      default: return 'text-muted-foreground';
    }
  };

  const getPriorityBg = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-error/10 border-error/20';
      case 'High': return 'bg-error/10 border-error/20';
      case 'Medium': return 'bg-warning/10 border-warning/20';
      case 'Low': return 'bg-info/10 border-info/20';
      default: return 'bg-muted/10 border-border';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Brain Dump</h1>
          <p className="text-muted-foreground mt-2">Transform your thoughts into organized, actionable tasks</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Schedule Settings */}
          {workSchedule && (
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-2 text-muted-foreground">
                {(() => {
                  const Icon = getScheduleIcon(workSchedule.type);
                  return <Icon className="h-4 w-4" />;
                })()}
                <span>{getScheduleDisplayName(workSchedule)}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                className="h-6 w-6 p-0"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          {/* Last Saved */}
          {lastSaved && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Save className="h-4 w-4" />
              <span>Last saved {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Settings Panel */}
      {showScheduleSettings && (
        <Card className="glass shadow-elevation">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Work Schedule Preferences</h2>
                <p className="text-sm text-muted-foreground">Configure your work hours for personalized task scheduling</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(scheduleTemplates).map(([key, template]) => {
                const Icon = getScheduleIcon(template.type);
                const isSelected = workSchedule?.type === template.type;
                
                return (
                  <Button
                    key={key}
                    variant={isSelected ? "default" : "outline"}
                    className={`h-auto p-4 flex-col space-y-2 ${
                      isSelected ? 'bg-gradient-primary text-white' : 'glass-surface'
                    }`}
                    onClick={() => saveWorkSchedule(template)}
                  >
                    <Icon className="h-6 w-6" />
                    <div className="text-center">
                      <div className="font-medium">{getScheduleDisplayName(template).split('(')[0].trim()}</div>
                      <div className="text-xs opacity-75">
                        {template.startTime} - {template.endTime}
                      </div>
                      <div className="text-xs opacity-60 mt-1">
                        Peak: {template.peakHours[0]}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
            
            {/* Current Schedule Details */}
            {workSchedule && (
              <div className="mt-6 p-4 glass-surface rounded-lg">
                <h3 className="font-medium text-foreground mb-3">Current Schedule Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Work Hours:</span>
                    <div className="font-medium">{workSchedule.startTime} - {workSchedule.endTime}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Peak Focus:</span>
                    <div className="font-medium">{workSchedule.peakHours.join(', ')}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Break Time:</span>
                    <div className="font-medium">{workSchedule.breakTime || 'Flexible'}</div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-lg">
                  <p className="text-sm text-info">
                    <strong>AI Scheduling:</strong> Tasks will be optimized for your {getScheduleDisplayName(workSchedule).toLowerCase()} with peak focus periods during {workSchedule.peakHours.join(' and ')}.
                  </p>
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowScheduleSettings(false)}
              >
                Close Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Brain Dump Input */}
        <div className="space-y-6">
          <Card className="glass shadow-elevation">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Daily Thoughts</h2>
                    <p className="text-sm text-muted-foreground">Dump everything on your mind</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVoiceToggle}
                    className={isRecording ? 'timer-active' : 'glass-surface'}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {isRecording ? 'Stop' : 'Voice'}
                  </Button>
                  {useWhisper && (
                    <div className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                      GPT-4o Whisper
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start typing or speaking your thoughts...

The AI will create optimal daily schedules by:
• Analyzing task complexity and priority
• Scheduling high-focus work during peak energy hours
• Grouping similar tasks to reduce context switching
• Creating realistic time blocks with proper buffers
• Automatically adding tasks and events to your calendar

Examples:
• Need to finish the quarterly reports by Friday - complex analysis work
• Call John about the marketing campaign - urgent follow-up needed
• Review the budget proposal from finance team - detailed review required
• Schedule team meeting for project planning - coordination needed
• Research new CRM tools for better productivity - exploration task"
                className="w-full min-h-[300px] p-4 glass-surface border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
              />

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {content.length} characters • {content.split(' ').filter(word => word.length > 0).length} words
                </div>
                <Button 
                  onClick={handleProcessDump}
                  disabled={!content.trim() || isProcessing}
                  className="bg-gradient-primary hover:bg-gradient-primary/90 text-white shadow-glow transition-all duration-300"
                >
                  {isProcessing ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Processing with AI...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Organize with AI
                    </>
                  )}
                </Button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Processing Status */}
          {isProcessing && (
            <Card className="glass shadow-elevation">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center animate-pulse-glow">
                    <Sparkles className="h-6 w-6 text-white animate-spin" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">AI is analyzing your thoughts...</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Extracting tasks, estimating time, and organizing priorities
                    </p>
                    <div className="w-64 h-2 bg-surface-elevated rounded-full mt-3">
                      <div className="h-full bg-gradient-primary rounded-full animate-pulse" style={{ width: '75%' }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Processed Tasks */}
        <div className="space-y-6">
          {processedTasks.length > 0 && (
            <Card className="glass shadow-elevation">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-success flex items-center justify-center shadow-glow">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Review & Import Tasks</h2>
                      <p className="text-sm text-muted-foreground">
                        {processedTasks.length} tasks found • {selectedTasks.size} selected
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="flex items-center space-x-2"
                    >
                      {selectedTasks.size === processedTasks.length ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span>{selectedTasks.size === processedTasks.length ? 'Deselect All' : 'Select All'}</span>
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-gradient-success hover:bg-gradient-success/90 text-white"
                      onClick={handleSaveTasks}
                      disabled={isSaving || selectedTasks.size === 0}
                    >
                      {isSaving ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Import Selected ({selectedTasks.size})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {processedTasks.map((task, index) => (
                  <div key={task.id || index} className={`p-4 rounded-lg border transition-all ${
                    selectedTasks.has(task.id) 
                      ? `${getPriorityBg(task.priority)} ring-2 ring-primary/30` 
                      : `${getPriorityBg(task.priority)} opacity-60`
                  }`}>
                    {/* Task Header with Checkbox */}
                    <div className="flex items-start space-x-3 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-1 h-8 w-8 flex-shrink-0"
                        onClick={() => toggleTaskSelection(task.id)}
                      >
                        {selectedTasks.has(task.id) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className={`h-4 w-4 ${getPriorityColor(task.priority)}`} />
                          <span className={`text-xs font-medium uppercase ${getPriorityColor(task.priority)}`}>
                            {task.priority} Priority
                          </span>
                          {task.suggestedDay && (
                            <span className="text-xs bg-info/10 text-info px-2 py-1 rounded">
                              {task.suggestedDay}
                            </span>
                          )}
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground ml-auto">
                            <Clock className="h-4 w-4" />
                            <span>{task.estimatedHours}h</span>
                          </div>
                        </div>
                        
                        {/* Editable Title */}
                        {editingTask === task.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => updateTaskField(task.id, 'title', e.target.value)}
                              className="w-full p-2 glass-surface border border-border rounded text-foreground font-semibold"
                              autoFocus
                            />
                            <textarea
                              value={task.description}
                              onChange={(e) => updateTaskField(task.id, 'description', e.target.value)}
                              className="w-full p-2 glass-surface border border-border rounded text-muted-foreground resize-none"
                              rows={2}
                            />
                            <div className="flex items-center space-x-2">
                              <select
                                value={task.priority}
                                onChange={(e) => updateTaskField(task.id, 'priority', e.target.value)}
                                className="p-1 glass-surface border border-border rounded text-sm"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                              </select>
                              <input
                                type="number"
                                value={task.estimatedHours}
                                onChange={(e) => updateTaskField(task.id, 'estimatedHours', parseFloat(e.target.value) || 0)}
                                className="w-20 p-1 glass-surface border border-border rounded text-sm"
                                step="0.5"
                                min="0"
                              />
                              <span className="text-sm text-muted-foreground">hours</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button size="sm" onClick={stopEditing} className="bg-gradient-success text-white">
                                <Check className="h-4 w-4 mr-1" />
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={stopEditing}>
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground">{task.title}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => startEditing(task.id)}
                                className="ml-2 flex-shrink-0"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {/* Optimal Scheduling Info */}
                        {task.optimalTimeSlot && (
                          <div className="mt-3 p-2 bg-primary/10 border border-primary/20 rounded-lg">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="font-medium text-primary">Optimal Time:</span>
                                <span className="text-foreground">{task.optimalTimeSlot}</span>
                              </div>
                              {task.energyLevel && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  task.energyLevel === 'High' ? 'bg-success/10 text-success' :
                                  task.energyLevel === 'Medium' ? 'bg-warning/10 text-warning' :
                                  'bg-info/10 text-info'
                                }`}>
                                  {task.energyLevel} Energy
                                </span>
                              )}
                            </div>
                            {task.focusType && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Best for: {task.focusType}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Micro Tasks */}
                        {task.microTasks && task.microTasks.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center">
                              <Target className="h-4 w-4 mr-2" />
                              Breakdown ({task.microTasks.length} steps)
                            </h4>
                            <div className="space-y-1">
                              {task.microTasks.map((microTask, microIndex) => (
                                <div key={microIndex} className="flex items-center p-2 glass-surface rounded">
                                  <CheckCircle2 className="h-3 w-3 text-muted-foreground mr-2 flex-shrink-0" />
                                  <span className="text-sm text-foreground">{microTask}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-2">
                              {task.tags.map((tag, tagIndex) => (
                                <span key={tagIndex} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Category */}
                        <div className="mt-3 pt-2 border-t border-border">
                          <span className="text-xs text-muted-foreground glass-surface px-2 py-1 rounded">
                            {task.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Daily Schedule Summary */}
          {dailySchedule && processedTasks.length > 0 && (
            <Card className="glass shadow-elevation">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-info flex items-center justify-center shadow-glow">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Daily Schedule</h2>
                    <p className="text-sm text-muted-foreground">AI-optimized time blocks</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Schedule Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 glass-surface rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Total Time</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground">
                      {dailySchedule.totalEstimatedHours}h
                    </p>
                  </div>
                  <div className="p-3 glass-surface rounded-lg">
                    <div className="flex items-center space-x-2 mb-1">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Workload</span>
                    </div>
                    <p className={`text-lg font-semibold ${
                      dailySchedule.workloadAssessment === 'Optimal' ? 'text-success' :
                      dailySchedule.workloadAssessment === 'Heavy' ? 'text-warning' :
                      'text-info'
                    }`}>
                      {dailySchedule.workloadAssessment}
                    </p>
                  </div>
                </div>

                {/* Time Blocks */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Recommended Schedule
                  </h4>
                  {dailySchedule.timeBlocks.map((block, index) => {
                    const task = processedTasks.find(t => t.id === block.taskId);
                    return (
                      <div key={index} className="p-3 glass-surface rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-primary">{block.time}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            task?.priority === 'Urgent' || task?.priority === 'High' ? 'bg-error/10 text-error' :
                            task?.priority === 'Medium' ? 'bg-warning/10 text-warning' :
                            'bg-info/10 text-info'
                          }`}>
                            {task?.priority} Priority
                          </span>
                        </div>
                        <p className="font-medium text-foreground text-sm">
                          {task?.title || 'Task'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {block.rationale}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips Card */}
          {processedTasks.length === 0 && !isProcessing && (
            <Card className="glass shadow-elevation">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">AI Tips</h2>
                    <p className="text-sm text-muted-foreground">Get better results</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 glass-surface rounded-lg">
                  <h3 className="font-medium text-sm">Be Specific</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Include deadlines, context, and any constraints
                  </p>
                </div>
                <div className="p-3 glass-surface rounded-lg">
                  <h3 className="font-medium text-sm">Include All Details</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mention projects, clients, and priority levels
                  </p>
                </div>
                <div className="p-3 glass-surface rounded-lg">
                  <h3 className="font-medium text-sm">Think Out Loud</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Include your thoughts, concerns, and ideas
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}