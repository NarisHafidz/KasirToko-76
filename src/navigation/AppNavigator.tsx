import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BarChart2, Box, CreditCard, LayoutGrid } from 'lucide-react-native';
import { useTheme } from '../config/ThemeContext';
import { DashboardScreen, POSScreen, ProductScreen, ReportScreen, ScannerScreen } from '../screens';
import { MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const MainTabNavigator = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBarBg,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 66,
          paddingBottom: 10,
          paddingTop: 8,
          paddingHorizontal: 12,
          justifyContent: 'space-around',
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: theme.colors.tabBarActive,
        tabBarInactiveTintColor: theme.colors.tabBarInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Ringkasan',
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size - 1} />,
        }}
      />
      <Tab.Screen
        name="POS"
        component={POSScreen}
        options={{
          tabBarLabel: 'Kasir',
          tabBarIcon: ({ color, size }) => <CreditCard color={color} size={size - 1} />,
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductScreen}
        options={{
          tabBarLabel: 'Produk',
          tabBarIcon: ({ color, size }) => <Box color={color} size={size - 1} />,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportScreen}
        options={{
          tabBarLabel: 'Laporan',
          tabBarIcon: ({ color, size }) => <BarChart2 color={color} size={size - 1} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="MainApp" component={MainTabNavigator} />
        <Stack.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
