import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen({ navigation }) {
	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.container}>
				<Text style={styles.title}>Student Dashboard</Text>
				<Text style={styles.subtitle}>Welcome to Gyanavriksha.</Text>

				<TouchableOpacity
					style={styles.button}
					activeOpacity={0.85}
					onPress={() => navigation?.navigate('SettingsScreen')}
				>
					<Text style={styles.buttonText}>Open Settings</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#F9F7F7',
	},
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	title: {
		fontSize: 28,
		fontWeight: '800',
		color: '#112D4E',
		textAlign: 'center',
	},
	subtitle: {
		marginTop: 8,
		fontSize: 15,
		color: '#64748B',
		textAlign: 'center',
	},
	button: {
		marginTop: 24,
		backgroundColor: '#112D4E',
		borderRadius: 10,
		paddingVertical: 12,
		paddingHorizontal: 18,
	},
	buttonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '700',
	},
});
