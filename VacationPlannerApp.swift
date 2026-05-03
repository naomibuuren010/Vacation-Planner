import SwiftUI
import SwiftData

@main
struct VacationPlannerApp: App {
    private var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Country.self,
            Place.self,
            Activity.self,
            Accommodation.self
        ])
        let configuration = ModelConfiguration(schema: schema)
        return try! ModelContainer(for: schema, configurations: [configuration])
    }()

    var body: some Scene {
        WindowGroup {
            AppRootView()
        }
        .modelContainer(sharedModelContainer)
    }
}

