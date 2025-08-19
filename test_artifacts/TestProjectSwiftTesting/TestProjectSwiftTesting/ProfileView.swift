import SwiftUI

struct ProfileView: View {
    @State private var username = "John Doe"
    @State private var email = "john@example.com"
    @State private var bio = "iOS Developer passionate about SwiftUI"
    @State private var showingEditSheet = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Profile Image
                    Circle()
                        .fill(LinearGradient(
                            gradient: Gradient(colors: [.blue, .purple]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 120, height: 120)
                        .overlay(
                            Text("JD")
                                .font(.largeTitle)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                        )
                    
                    // User Info
                    VStack(spacing: 8) {
                        Text(username)
                            .font(.title)
                            .fontWeight(.semibold)
                        
                        Text(email)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    
                    // Bio Section
                    VStack(alignment: .leading, spacing: 10) {
                        Text("About")
                            .font(.headline)
                        
                        Text(bio)
                            .font(.body)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(10)
                    .padding(.horizontal)
                    
                    // Stats
                    HStack(spacing: 40) {
                        VStack {
                            Text("42")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("Projects")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        VStack {
                            Text("128")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("Followers")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        VStack {
                            Text("89")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("Following")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical)
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Edit") {
                        showingEditSheet = true
                    }
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            Text("Edit Profile View")
        }
    }
}

#Preview {
    ProfileView()
}