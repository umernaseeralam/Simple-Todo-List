import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  category: string;
}

// Constants
const STORAGE_KEY = '@todos_v3'; // versioned key for future migrations
const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Shopping', 'Health', 'Other'];

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newTodoCategory, setNewTodoCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'todos', title: 'Todo List' },
    { key: 'progress', title: 'Monthly Progress' },
  ]);

  // Load todos from storage when app starts
  useEffect(() => {
    loadTodos();
  }, []);

  // Save todos to storage whenever they change
  useEffect(() => {
    if (!isLoading) {
      saveTodos();
    }
  }, [todos, isLoading]);

  const loadTodos = async () => {
    setIsLoading(true);
    try {
      const storedTodos = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedTodos) {
        setTodos(JSON.parse(storedTodos));
      }
    } catch (error) {
      console.error('Error loading todos:', error);
      Alert.alert('Error', 'Failed to load your todos. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveTodos = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (error) {
      console.error('Error saving todos:', error);
      Alert.alert('Error', 'Failed to save your changes. Please try again.');
    }
  };

  const addTodo = () => {
    if (newTodo.trim()) {
      const newTodoItem: Todo = {
        id: Date.now().toString(),
        text: newTodo.trim(),
        completed: false,
        createdAt: Date.now(),
        category: newTodoCategory,
      };
      
      setTodos(prevTodos => [newTodoItem, ...prevTodos]);
      setNewTodo('');
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    Alert.alert(
      'Delete Todo',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          onPress: () => setTodos(todos.filter((todo) => todo.id !== id)),
          style: 'destructive'
        }
      ]
    );
  };

  const editTodo = (id: string, newText: string, newCategory?: string) => {
    if (newText.trim()) {
      setTodos(
        todos.map((todo) =>
          todo.id === id ? { 
            ...todo, 
            text: newText.trim(),
            ...(newCategory ? { category: newCategory } : {})
          } : todo
        )
      );
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTodos().then(() => setRefreshing(false));
  }, []);

  const clearCompleted = () => {
    Alert.alert(
      'Clear Completed',
      'Are you sure you want to remove all completed tasks?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          onPress: () => setTodos(todos.filter(todo => !todo.completed)),
          style: 'destructive'
        }
      ]
    );
  };

  const filteredTodos = useMemo(() => {
    return todos.filter(todo => {
      // Filter by completion status
      const statusMatch = 
        filter === 'all' ? true : 
        filter === 'active' ? !todo.completed : 
        todo.completed;
      
      // Filter by category
      const categoryMatch = 
        selectedCategory === 'All' ? true : 
        todo.category === selectedCategory;
      
      return statusMatch && categoryMatch;
    });
  }, [todos, filter, selectedCategory]);

  // Calculate monthly progress data
  const monthlyProgressData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Initialize data arrays
    const labels: string[] = [];
    const completedData: number[] = [];
    const totalData: number[] = [];
    
    // Group todos by day of month
    const todosByDay: Record<number, { completed: number, total: number }> = {};
    
    // Initialize all days
    for (let day = 1; day <= daysInMonth; day++) {
      todosByDay[day] = { completed: 0, total: 0 };
    }
    
    // Count todos for each day
    todos.forEach(todo => {
      const todoDate = new Date(todo.createdAt);
      const todoMonth = todoDate.getMonth();
      const todoYear = todoDate.getFullYear();
      
      // Only count todos from current month
      if (todoMonth === currentMonth && todoYear === currentYear) {
        const day = todoDate.getDate();
        todosByDay[day].total += 1;
        if (todo.completed) {
          todosByDay[day].completed += 1;
        }
      }
    });
    
    // Create chart data (use last 7 days for better visualization)
    const today = now.getDate();
    const startDay = Math.max(1, today - 6);
    
    for (let day = startDay; day <= today; day++) {
      labels.push(`${day}`);
      completedData.push(todosByDay[day].completed);
      totalData.push(todosByDay[day].total);
    }
    
    return {
      labels,
      datasets: [
        {
          data: completedData,
          color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: totalData,
          color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: ['Completed', 'Total']
    };
  }, [todos]);

  // Calculate category statistics
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number, completed: number }> = {};
    
    // Initialize stats for all categories
    categories.forEach(category => {
      stats[category] = { total: 0, completed: 0 };
    });
    
    // Count todos by category
    todos.forEach(todo => {
      if (stats[todo.category]) {
        stats[todo.category].total += 1;
        if (todo.completed) {
          stats[todo.category].completed += 1;
        }
      }
    });
    
    // Convert to chart data format
    const data = Object.keys(stats).map(category => {
      const completionRate = stats[category].total > 0 
        ? (stats[category].completed / stats[category].total) * 100 
        : 0;
      return Math.round(completionRate);
    });
    
    return {
      labels: Object.keys(stats),
      data,
    };
  }, [todos, categories]);

  const TodoItem = ({ item }: { item: Todo }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(item.text);
    const [editCategory, setEditCategory] = useState(item.category);

    const handleEdit = () => {
      setIsEditing(true);
      setEditText(item.text);
      setEditCategory(item.category);
    };

    const saveEdit = () => {
      editTodo(item.id, editText, editCategory);
      setIsEditing(false);
    };

    return (
      <View style={styles.todoItem}>
        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              autoFocus
              onSubmitEditing={saveEdit}
            />
            <View style={styles.editCategoryContainer}>
              <Picker
                selectedValue={editCategory}
                style={styles.editCategoryPicker}
                onValueChange={(itemValue: string) => setEditCategory(itemValue)}
              >
                {categories.map((category) => (
                  <Picker.Item key={category} label={category} value={category} />
                ))}
              </Picker>
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity 
              style={styles.checkboxContainer} 
              onPress={() => toggleTodo(item.id)}
            >
              <View style={[
                styles.checkbox,
                item.completed && styles.checkedCheckbox
              ]}>
                {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
            
            <View style={styles.todoContent}>
              <Text 
                style={[
                  styles.todoText, 
                  item.completed && styles.completedTodo
                ]}
                onPress={handleEdit}
              >
                {item.text}
              </Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleEdit}
              >
                <Ionicons name="pencil" size={22} color="#2196F3" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => deleteTodo(item.id)}
              >
                <Ionicons name="trash" size={22} color="#ff4444" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  const TodoListRoute = () => (
    <>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newTodo}
          onChangeText={setNewTodo}
          placeholder="Add a new todo..."
          onSubmitEditing={addTodo}
          returnKeyType="done"
        />
        <View style={styles.categoryPickerContainer}>
          <Picker
            selectedValue={newTodoCategory}
            style={styles.categoryPicker}
            onValueChange={(itemValue: string) => setNewTodoCategory(itemValue)}
          >
            {categories.map((category) => (
              <Picker.Item key={category} label={category} value={category} />
            ))}
          </Picker>
        </View>
        <TouchableOpacity 
          style={[styles.addButton, !newTodo.trim() && styles.disabledButton]} 
          onPress={addTodo}
          disabled={!newTodo.trim()}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'all' && styles.activeFilter]} 
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'active' && styles.activeFilter]} 
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.filterText, filter === 'active' && styles.activeFilterText]}>
              Active
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'completed' && styles.activeFilter]} 
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.activeFilterText]}>
              Completed
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={clearCompleted}
          >
            <Text style={styles.clearButtonText}>Clear Completed</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.categoryFilterContainer}>
        <Text style={styles.categoryFilterLabel}>Filter by category:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.categoryFilterButton, selectedCategory === 'All' && styles.activeCategoryFilter]} 
            onPress={() => setSelectedCategory('All')}
          >
            <Text style={[styles.categoryFilterText, selectedCategory === 'All' && styles.activeCategoryFilterText]}>
              All
            </Text>
          </TouchableOpacity>
          
          {categories.map((category) => (
            <TouchableOpacity 
              key={category}
              style={[styles.categoryFilterButton, selectedCategory === category && styles.activeCategoryFilter]} 
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryFilterText, selectedCategory === category && styles.activeCategoryFilterText]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <>
          {filteredTodos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="list" size={60} color="#ccc" />
              <Text style={styles.emptyText}>
                {filter === 'all' 
                  ? "No todos yet. Add some!" 
                  : filter === 'active' 
                    ? "No active todos" 
                    : "No completed todos"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredTodos}
              renderItem={({ item }) => <TodoItem item={item} />}
              keyExtractor={(item) => item.id}
              style={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}
          
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {todos.filter(t => !t.completed).length} items left
            </Text>
          </View>
        </>
      )}
    </>
  );

  const ProgressRoute = () => (
    <ScrollView style={styles.progressContainer}>
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Last 7 Days Activity</Text>
        <LineChart
          data={monthlyProgressData}
          width={Dimensions.get('window').width - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Completion Rate by Category (%)</Text>
        <BarChart
          data={{
            labels: categoryStats.labels,
            datasets: [
              {
                data: categoryStats.data,
              },
            ],
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(131, 90, 241, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
          }}
          style={styles.chart}
        />
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Monthly Summary</Text>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Tasks:</Text>
          <Text style={styles.summaryValue}>{todos.length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Completed Tasks:</Text>
          <Text style={styles.summaryValue}>{todos.filter(t => t.completed).length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Completion Rate:</Text>
          <Text style={styles.summaryValue}>
            {todos.length > 0 
              ? `${Math.round((todos.filter(t => t.completed).length / todos.length) * 100)}%` 
              : '0%'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderScene = SceneMap({
    todos: TodoListRoute,
    progress: ProgressRoute,
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>My Todo List</Text>
      </View>
      
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: Dimensions.get('window').width }}
        renderTabBar={props => (
          <TabBar
            {...props}
            style={styles.tabBar}
            indicatorStyle={styles.tabIndicator}
            activeColor="#2196F3"
            inactiveColor="#757575"
          />
        )}
      />
      
      <StatusBar style="light" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabIndicator: {
    backgroundColor: '#2196F3',
    height: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  categoryPickerContainer: {
    height: 46,
    width: 150,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: Platform.OS === 'android' ? 0 : 10,
  },
  categoryPicker: {
    height: Platform.OS === 'ios' ? 46 : 50,
    width: Platform.OS === 'android' ? 170 : 150,
    marginLeft: Platform.OS === 'android' ? -10 : 0,
    marginRight: Platform.OS === 'android' ? -10 : 0,
    marginTop: Platform.OS === 'android' ? -6 : 0,
    marginBottom: Platform.OS === 'android' ? -6 : 0,
    color: '#424242',
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    height: 46,
    justifyContent: 'center',
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#b0bec5',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  todoItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedCheckbox: {
    backgroundColor: '#2196F3',
  },
  todoContent: {
    flex: 1,
    marginRight: 10,
  },
  todoText: {
    fontSize: 16,
    marginBottom: 4,
  },
  completedTodo: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: '#2196F3',
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
    marginLeft: 4,
  },
  editContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  editCategoryContainer: {
    height: 40,
    width: 130,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: Platform.OS === 'android' ? 0 : 8,
  },
  editCategoryPicker: {
    height: Platform.OS === 'ios' ? 40 : 44,
    width: Platform.OS === 'android' ? 150 : 130,
    marginLeft: Platform.OS === 'android' ? -10 : 0,
    marginRight: Platform.OS === 'android' ? -10 : 0,
    marginTop: Platform.OS === 'android' ? -6 : 0,
    marginBottom: Platform.OS === 'android' ? -6 : 0,
    color: '#424242',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
  },
  filterContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  activeFilter: {
    backgroundColor: '#e3f2fd',
  },
  filterText: {
    color: '#757575',
    fontSize: 14,
  },
  activeFilterText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  clearButtonText: {
    color: '#ff4444',
    fontSize: 14,
  },
  categoryFilterContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryFilterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#424242',
  },
  categoryFilterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#f5f5f5',
  },
  activeCategoryFilter: {
    backgroundColor: '#e3f2fd',
  },
  categoryFilterText: {
    color: '#757575',
    fontSize: 14,
  },
  activeCategoryFilterText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  statsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  statsText: {
    fontSize: 14,
    color: '#757575',
  },
  progressContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#424242',
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#424242',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#616161',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
});